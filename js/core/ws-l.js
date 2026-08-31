(function() {
    // Scope wrapper to prevent variable redeclaration errors
    let currentIndex = 0;
    let resetTimeout;
    let indicatorObserver;
        
        const updateIndicator = (activeElement) => {
            // No-op: indicator removed, using simple hover/active effect
        };
        
        function initSidebarState() {
            try {
                const navContainer = document.getElementById('navContainer');
                if (!navContainer) return;

                const items = navContainer.querySelectorAll('.nav-item');
                // Default home once per load; never yank back after the user leaves.
                if (window.SolisFirstLanding && typeof window.SolisFirstLanding.needsLanding === 'function'
                    && window.SolisFirstLanding.needsLanding()
                    && typeof window.SolisFirstLanding.applyCreateLanding === 'function') {
                    window.SolisFirstLanding.applyCreateLanding();
                }

                const savedTarget = localStorage.getItem('currentNavigationTarget') || 'clips';
                const clipsItem = navContainer.querySelector(`.nav-item[data-target="${savedTarget}"]`)
                    || navContainer.querySelector('.nav-item[data-target="clips"]')
                    || Array.from(items).find(item => !item.classList.contains('disabled'));
                if (!clipsItem) return;

                currentIndex = Array.from(items).indexOf(clipsItem);
                items.forEach(item => item.classList.remove('active'));
                clipsItem.classList.add('active');
                setTimeout(() => updateIndicator(clipsItem), 0);
                try {
                    localStorage.setItem('sidebarActiveIndex', String(currentIndex));
                } catch (_) {}

                const target = clipsItem.getAttribute('data-target') || 'clips';
                switchSection(target);
                if ((target === 'clips' || target === 'clips-studio' || target === 'clipsContainer')
                    && typeof window.switchClipsTab === 'function') {
                    const tab = localStorage.getItem('clipsActiveTab')
                        || localStorage.getItem('clipsStudioCurrentTab')
                        || 'templates';
                    const safeTab = (tab === 'create' && window.innerWidth <= 768) ? 'templates' : tab;
                    const tabBtn = document.querySelector(`.clips-tab[data-tab="${safeTab}"], .clips-sub-item[data-tab="${safeTab}"]`);
                    window.switchClipsTab(safeTab, tabBtn);
                }
            } catch (err) {
                console.error('Failed to restore sidebar state:', err);
            }
        }
        
        function initIndicatorTracking() {
            const navContainer = document.getElementById('navContainer');
            if (!navContainer) return;
            
            // Set initial position
            const initialActive = navContainer.querySelector('.nav-item.active');
            if (initialActive) {
                updateIndicator(initialActive);
            }
            
            // Watch for class changes on nav items
            if (indicatorObserver) indicatorObserver.disconnect();
            
            indicatorObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const target = mutation.target;
                        if (target.classList.contains('active')) {
                            updateIndicator(target);
                        }
                    }
                });
            });
            
            navContainer.querySelectorAll('.nav-item').forEach((item) => {
                indicatorObserver.observe(item, { attributes: true, attributeFilter: ['class'] });
            });
        }
        function showNotification(message, type = 'success') {
            // Prefer the shared dashboard toast (centered, proper fade) when available
            if (typeof window.__solisShowNotification === 'function') {
                window.__solisShowNotification(message, type);
                return;
            }
            const notifContainer = document.getElementById('notificationContainer') || createNotificationContainer();
            const notification = document.createElement('div');
            const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
            notification.className = `notification notification-${safeType} ${safeType}`;
            notification.innerHTML = `
                <div class="notification-content">
                    <span class="notification-message"></span>
                </div>
            `;
            notification.querySelector('.notification-message').textContent = String(message || '');
            notifContainer.appendChild(notification);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => notification.classList.add('show'));
            });
            setTimeout(() => {
                notification.classList.remove('show');
                notification.classList.add('is-leaving');
                setTimeout(() => notification.remove(), 320);
            }, 3500);
        }

        function createNotificationContainer() {
            const container = document.createElement('div');
            container.id = 'notificationContainer';
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
            return container;
        }
        window.addEventListener('videoGenerated', (event) => {
            const videoTitle = event.detail?.title || 'Video';
            showNotification(` ${videoTitle} has been generated successfully!`, 'success');
        });

        window.addEventListener('videoGenerationError', (event) => {
            const errorMsg = event.detail?.message || 'An error occurred';
            showNotification(` ${errorMsg}`, 'error');
        });

        window.addEventListener('videoGenerationProgress', (event) => {
            const progress = event.detail?.progress || '';
            showNotification(` ${progress}`, 'info');
        });

        window.notificationAPI = {
            success: (message) => showNotification(message, 'success'),
            error: (message) => showNotification(message, 'error'),
            info: (message) => showNotification(message, 'info'),
            warning: (message) => showNotification(message, 'warning'),
            videoGenerated: (videoTitle) => {
                const event = new CustomEvent('videoGenerated', {
                    detail: { title: videoTitle }
                });
                window.dispatchEvent(event);
            },
            videoError: (errorMessage) => {
                const event = new CustomEvent('videoGenerationError', {
                    detail: { message: errorMessage }
                });
                window.dispatchEvent(event);
            },
            videoProgress: (progressMessage) => {
                const event = new CustomEvent('videoGenerationProgress', {
                    detail: { progress: progressMessage }
                });
                window.dispatchEvent(event);
            }
        };

        // Prefer shared toast from s.js; never overwrite it
        if (typeof window.showNotification === 'function') {
            window.__solisShowNotification = window.showNotification;
        } else {
            window.showNotification = showNotification;
            window.__solisShowNotification = showNotification;
        }
        function initializeVideoGenerationSocket() {
            try {
                if (typeof io === 'undefined') {
                    console.warn('Socket.IO not loaded yet, retrying...');
                    setTimeout(initializeVideoGenerationSocket, 500);
                    return;
                }
                // Socket.IO lives on the API host (api.solisai.video), not the marketing site
                const socketUrl = (typeof window.getSolisSocketOrigin === 'function')
                    ? window.getSolisSocketOrigin()
                    : ((window.API_BASE_URL || 'https://api.solisai.video/api').toString().replace(/\/api\/?$/, '') || 'https://api.solisai.video');
                
                
                // Get JWT token from sessionStorage for authentication
                // Try multiple locations for backward compatibility
                let token = (
                    sessionStorage.getItem('auth_token') || 
                    sessionStorage.getItem('jwt_token') ||
                    localStorage.getItem('auth_token')
                );
                
                
                const socket = io(socketUrl, {
                    transports: ['websocket', 'polling'],
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 10,
                    reconnection: true,
                    path: '/socket.io/',
                    auth: {
                        token: token || null,  // Pass JWT token or null if not available
                        timestamp: Date.now()
                    },
                    withCredentials: true  // Send httpOnly cookies with WebSocket
                });
                
                socket.on('connect', () => {
                });
                
                socket.on('video_generated', (data) => {
                    try {
                        showNotification(` ${data.video_title || 'Your video'} has been generated successfully!`, 'success');
                        window.dispatchEvent(new CustomEvent('videoGenerated', {
                            detail: { title: data.video_title, id: data.video_id }
                        }));
                    } catch (err) {
                        console.error('Error handling video_generated event:', err);
                    }
                });
                
                socket.on('video_generation_error', (data) => {
                    try {
                        showNotification(` ${data.message || 'Video generation failed'}`, 'error');
                        
                        window.dispatchEvent(new CustomEvent('videoGenerationError', {
                            detail: { message: data.message }
                        }));
                    } catch (err) {
                        console.error('Error handling video_generation_error event:', err);
                    }
                });
                
                socket.on('video_generation_progress', (data) => {
                    try {
                        showNotification(` ${data.message || 'Processing...'}`, 'info');
                        
                        window.dispatchEvent(new CustomEvent('videoGenerationProgress', {
                            detail: { progress: data.message }
                        }));
                    } catch (err) {
                        console.error('Error handling video_generation_progress event:', err);
                    }
                });
                let lastErrorNotificationTime = 0;
                const ERROR_NOTIFICATION_COOLDOWN = 5000;
                
                socket.on('connect_error', (error) => {
                    console.error('Socket.IO connection error:', error);
                });
                
                socket.on('disconnect', () => {
                });
                
                window.videoGenerationSocket = socket;
            } catch (err) {
                console.error('Failed to initialize video generation socket:', err);
            }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeVideoGenerationSocket);
        } else {
            initializeVideoGenerationSocket();
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initSidebarState();
                initIndicatorTracking();
            });
        } else {
            initSidebarState();
            initIndicatorTracking();
        }

        function navigate(element, index) {
            if (element.classList.contains('disabled')) return;
            if (index === currentIndex) return;

            const navContainer = document.getElementById('navContainer');
            const items = navContainer.querySelectorAll('.nav-item');
            
            // Remove active from all items
            items.forEach(item => item.classList.remove('active'));
            
            // Add active to clicked item
            element.classList.add('active');
            currentIndex = index;
            
            // Directly update indicator position
            updateIndicator(element);
            
            // Save state
            try {
                localStorage.setItem('sidebarActiveIndex', index);
            } catch (err) {
                console.error('Failed to save sidebar state:', err);
            }
            
            // Switch section
            const target = element.getAttribute('data-target');
            if (target) {
                try { localStorage.setItem('currentNavigationTarget', target); } catch (_) {}
                // User left the default home — never re-force Create this session
                try { window.SolisFirstLanding?.markSeen?.(); } catch (_) {}
                switchSection(target);
            }
        }
        
        // Expose navigate globally
        window.navigate = navigate;

        let _mnavSectionAnimating = false;

        function switchSection(target, opts) {
            const options = opts || {};
            const skipHide = options.keepVisible || null; // element to keep visible during anim
            try {
                if (target) localStorage.setItem('currentNavigationTarget', target);
            } catch (_) {}
            const dashboardContainer = document.getElementById('dashboardContainer');
            const portalContainer = document.getElementById('portalContainer');
            const clipsContainer = document.getElementById('clipsContainer');
            const customEditorContainer = document.getElementById('customEditorContainer');
            const inputSection = document.querySelector('.input-section');
            [dashboardContainer, portalContainer, clipsContainer, customEditorContainer].forEach(el => {
                if (!el) return;
                if (skipHide && el === skipHide) return;
                el.style.display = 'none';
                el.classList.remove('active');
            });
            if (inputSection) {
                inputSection.classList.remove('active');
                inputSection.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; z-index: -10000 !important;';
            }

            const clipsSubNav = document.getElementById('clipsSubNav');
            const isMobile = window.innerWidth <= 768;
            const onPortal = target === 'Portal';

            document.body.classList.toggle('mnav-on-portal', isMobile && onPortal);

            if (target === 'dashboard' && dashboardContainer) {
                dashboardContainer.style.display = 'block';
                dashboardContainer.classList.add('active');
                if (window.analyticsManager) window.analyticsManager.updateCharts();
                if (clipsSubNav && !isMobile) clipsSubNav.style.display = 'none';
            } else if (target === 'Portal' && portalContainer) {
                portalContainer.style.display = 'block';
                portalContainer.classList.add('active');
                if (clipsSubNav && !isMobile) clipsSubNav.style.display = 'none';
            } else if (target === 'clips' && clipsContainer) {
                clipsContainer.style.display = 'block';
                clipsContainer.classList.add('active');
                if (clipsSubNav) {
                    clipsSubNav.style.display = '';
                    clipsSubNav.style.removeProperty('display');
                }
                if (window.clipsStudio && !window.clipsStudio.initialized) {
                    window.clipsStudio.init();
                }
            }

            // Mobile primary nav is always the Template / CLIP / Library bar
            if (isMobile && clipsSubNav) {
                clipsSubNav.style.display = '';
                clipsSubNav.style.removeProperty('display');
            }
        }

        function _clearMnavAnimClasses(el) {
            if (!el) return;
            el.classList.remove(
                'mnav-section-anim',
                'mnav-enter-from-left',
                'mnav-enter-from-right',
                'mnav-exit-to-left',
                'mnav-exit-to-right'
            );
            el.style.removeProperty('transform');
            el.style.removeProperty('opacity');
        }

        /** Smooth Portal ↔ Templates page transition (mobile). toPortal=true → Portal enters from left. */
        function transitionPortalTemplates(toPortal) {
            if (window.innerWidth > 768) {
                if (toPortal) {
                    try { localStorage.setItem('currentNavigationTarget', 'Portal'); } catch (_) {}
                    const portalItem = document.querySelector('.nav-item[data-target="Portal"]');
                    document.querySelectorAll('.nav-item[data-target]').forEach((i) => i.classList.remove('active'));
                    portalItem?.classList.add('active');
                    switchSection('Portal');
                } else {
                    goMobileClipsTab('templates');
                }
                return;
            }
            if (_mnavSectionAnimating) return;

            const portal = document.getElementById('portalContainer');
            const clips = document.getElementById('clipsContainer');
            if (!portal || !clips) return;

            const incoming = toPortal ? portal : clips;
            const outgoing = toPortal ? clips : portal;
            const alreadyThere = toPortal
                ? document.body.classList.contains('mnav-on-portal')
                : !document.body.classList.contains('mnav-on-portal') && clips.classList.contains('active');
            if (alreadyThere && !toPortal) {
                // Ensure templates tab
                goMobileClipsTab('templates');
                return;
            }
            if (alreadyThere && toPortal) return;

            _mnavSectionAnimating = true;

            // Prep incoming under outgoing
            incoming.style.display = 'block';
            incoming.classList.add('active', 'mnav-section-anim');
            outgoing.classList.add('mnav-section-anim');
            void incoming.offsetWidth;

            incoming.classList.add(toPortal ? 'mnav-enter-from-left' : 'mnav-enter-from-right');
            outgoing.classList.add(toPortal ? 'mnav-exit-to-right' : 'mnav-exit-to-left');

            // Sync nav chrome immediately so the pill feels in sync
            document.body.classList.toggle('mnav-on-portal', toPortal);
            if (toPortal) {
                try { localStorage.setItem('currentNavigationTarget', 'Portal'); } catch (_) {}
                const portalItem = document.querySelector('.nav-item[data-target="Portal"]');
                document.querySelectorAll('.nav-item[data-target]').forEach((i) => i.classList.remove('active'));
                portalItem?.classList.add('active');
                document.querySelectorAll('.clips-sub-item').forEach((b) => {
                    const on = b.getAttribute('data-tab') === 'portal';
                    b.classList.toggle('active', on);
                    b.setAttribute('aria-selected', on ? 'true' : 'false');
                });
            } else {
                try { localStorage.setItem('currentNavigationTarget', 'clips'); } catch (_) {}
                const clipsItem = document.querySelector('.nav-item[data-target="clips"]');
                document.querySelectorAll('.nav-item[data-target]').forEach((i) => i.classList.remove('active'));
                clipsItem?.classList.add('active');
                if (typeof window.switchClipsTab === 'function') {
                    const btn = document.querySelector('.clips-sub-item[data-tab="templates"]');
                    window.switchClipsTab('templates', btn);
                }
                requestAnimationFrame(() => updateMobileClipsPillIndicator('templates'));
            }

            const finish = () => {
                _clearMnavAnimClasses(incoming);
                _clearMnavAnimClasses(outgoing);
                outgoing.style.display = 'none';
                outgoing.classList.remove('active');
                incoming.style.display = 'block';
                incoming.classList.add('active');
                const clipsSubNav = document.getElementById('clipsSubNav');
                if (clipsSubNav) {
                    clipsSubNav.style.display = '';
                    clipsSubNav.style.removeProperty('display');
                }
                if (!toPortal && window.clipsStudio && !window.clipsStudio.initialized) {
                    window.clipsStudio.init();
                }
                _mnavSectionAnimating = false;
            };

            clearTimeout(transitionPortalTemplates._t);
            transitionPortalTemplates._t = setTimeout(finish, 420);
            if (window.navigator.vibrate) window.navigator.vibrate(8);
        }

        function goMobilePortal() {
            window.closeMobileNavMenu?.();
            window.closeMobileCreateSheet?.({ immediate: true });
            transitionPortalTemplates(true);
        }

        function goMobileTemplatesFromPortal() {
            window.closeMobileNavMenu?.();
            transitionPortalTemplates(false);
        }

        function updateMobileClipsPillIndicator(tabName) {
            const indicator = document.getElementById('clipsSubPane');
            const pill = document.querySelector('.clips-sub-pill');
            if (!indicator || !pill || window.innerWidth > 768) return;
            const tab = tabName
                || document.querySelector('.clips-sub-item.active')?.getAttribute('data-tab')
                || localStorage.getItem('clipsActiveTab')
                || 'create';
            const btn = document.querySelector(`.clips-sub-item[data-tab="${tab}"]`);
            if (!btn) return;
            const pillRect = pill.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();
            indicator.style.width = `${btnRect.width}px`;
            indicator.style.transform = `translateX(${btnRect.left - pillRect.left - 5}px)`;
            indicator.style.left = '5px';
        }

        function goMobileClipsTab(tabName, buttonElement) {
            try { localStorage.setItem('currentNavigationTarget', 'clips'); } catch (_) {}
            window.closeMobileNavMenu?.();

            // Create = bottom URL sheet, not a full section
            if (tabName === 'create') {
                if (window.innerWidth <= 768) {
                    window.openMobileCreateSheet?.();
                    return;
                }
            } else {
                window.closeMobileCreateSheet?.({ immediate: true });
            }

            // From Portal → Templates gets the page slide (not a hard cut)
            if (window.innerWidth <= 768
                && document.body.classList.contains('mnav-on-portal')
                && tabName === 'templates') {
                transitionPortalTemplates(false);
                return;
            }

            const order = ['templates', 'library'];
            const prevTab = document.querySelector('.clips-sub-item.active:not(.clips-sub-create)')?.getAttribute('data-tab')
                || localStorage.getItem('clipsActiveTab')
                || 'templates';
            const fromIdx = order.indexOf(prevTab === 'create' ? 'templates' : prevTab);
            const toIdx = order.indexOf(tabName);
            const dir = (toIdx > fromIdx) ? 'left' : (toIdx < fromIdx) ? 'right' : null;

            switchSection('clips');
            const btn = buttonElement || document.querySelector(`.clips-sub-item[data-tab="${tabName}"]`);
            if (typeof window.switchClipsTab === 'function') {
                window.switchClipsTab(tabName, btn);
            }

            const nextSec = document.getElementById(`${tabName}Section`);
            if (nextSec && dir) {
                nextSec.classList.remove('clips-slide-from-left', 'clips-slide-from-right');
                void nextSec.offsetWidth;
                nextSec.classList.add(dir === 'left' ? 'clips-slide-from-right' : 'clips-slide-from-left');
                clearTimeout(nextSec._clipsSlideT);
                nextSec._clipsSlideT = setTimeout(() => {
                    nextSec.classList.remove('clips-slide-from-left', 'clips-slide-from-right');
                }, 400);
            }

            requestAnimationFrame(() => updateMobileClipsPillIndicator(tabName));
            if (window.navigator.vibrate) window.navigator.vibrate(8);
        }

        function initMobileClipsSwipe() {
            const root = document.getElementById('clipsContainer') || document.querySelector('.main-content');
            if (!root || root.dataset.clipsSwipeBound === '1') return;
            root.dataset.clipsSwipeBound = '1';

            const order = ['templates', 'library'];
            const AXIS_LOCK_PX = 12;
            const COMMIT_PX = 72;
            const COMMIT_RATIO = 0.28;

            let startX = 0;
            let startY = 0;
            let startT = 0;
            let tracking = false;
            let axis = null; // null | 'x' | 'y'
            let dragSec = null;
            let lastDx = 0;

            function activeSectionEl() {
                return document.querySelector('#clipsContainer .clips-section.active')
                    || document.querySelector('.clips-section.active');
            }

            function clearDragStyles(sec, animateBack) {
                if (!sec) return;
                if (animateBack) {
                    sec.classList.add('clips-drag-snap');
                    sec.style.transform = '';
                    sec.style.opacity = '';
                    const done = () => {
                        sec.classList.remove('clips-drag', 'clips-drag-snap');
                        sec.style.transition = '';
                        sec.removeEventListener('transitionend', done);
                    };
                    sec.addEventListener('transitionend', done);
                    setTimeout(done, 320);
                } else {
                    sec.classList.remove('clips-drag', 'clips-drag-snap');
                    sec.style.transform = '';
                    sec.style.opacity = '';
                    sec.style.transition = '';
                }
            }

            function currentTabIndex() {
                const activeBtn = document.querySelector('.clips-sub-item.active:not(.clips-sub-create)');
                const cur = activeBtn?.getAttribute('data-tab')
                    || localStorage.getItem('clipsActiveTab')
                    || 'templates';
                const safe = cur === 'create' ? 'templates' : cur;
                return order.indexOf(safe);
            }

            root.addEventListener('touchstart', (e) => {
                if (window.innerWidth > 768) return;
                if (document.body.classList.contains('mnav-create-open')) return;
                if (!e.touches || e.touches.length !== 1) return;
                const t = e.target;
                if (t && t.closest && t.closest(
                    'input, textarea, select, [contenteditable="true"],' +
                    '.preview-placeholder, .sub-text-block, .url-input-wrapper,' +
                    '.preview-timeline-wrap, .template-preview-modal, .stgModal,' +
                    '.mobile-clips-bar, .clips-sub-nav'
                )) {
                    tracking = false;
                    return;
                }
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                startT = Date.now();
                tracking = true;
                axis = null;
                lastDx = 0;
                dragSec = activeSectionEl();
            }, { passive: true });

            root.addEventListener('touchmove', (e) => {
                if (!tracking || window.innerWidth > 768) return;
                if (!e.touches || e.touches.length !== 1) return;
                const touch = e.touches[0];
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;

                if (!axis) {
                    if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
                    // Vertical intent → never hijack (fixes Library scroll flipping tabs)
                    if (Math.abs(dy) >= Math.abs(dx)) {
                        axis = 'y';
                        tracking = false;
                        clearDragStyles(dragSec, false);
                        dragSec = null;
                        return;
                    }
                    axis = 'x';
                    if (dragSec) {
                        dragSec.classList.add('clips-drag');
                        dragSec.classList.remove('clips-drag-snap', 'clips-slide-from-left', 'clips-slide-from-right');
                    }
                }

                if (axis !== 'x') return;
                if (e.cancelable) e.preventDefault();

                const idx = currentTabIndex();
                let clamped = dx;
                // Soft edge — still allow a clear pull toward Portal from Templates
                if (idx <= 0 && dx > 0) clamped = dx * 0.62;
                if (idx >= order.length - 1 && dx < 0) clamped = dx * 0.28;
                lastDx = clamped;

                if (dragSec) {
                    const fade = Math.max(0.72, 1 - Math.abs(clamped) / (window.innerWidth * 1.4));
                    dragSec.style.transform = `translate3d(${clamped}px, 0, 0)`;
                    dragSec.style.opacity = String(fade);
                }
            }, { passive: false });

            function finishSwipe(e) {
                if (!tracking && axis !== 'x') {
                    axis = null;
                    dragSec = null;
                    return;
                }
                const wasHorizontal = axis === 'x';
                tracking = false;
                axis = null;

                if (!wasHorizontal) {
                    clearDragStyles(dragSec, false);
                    dragSec = null;
                    return;
                }

                const touch = e.changedTouches && e.changedTouches[0];
                const dx = touch ? (touch.clientX - startX) : lastDx;
                const elapsed = Math.max(16, Date.now() - startT);
                const velocity = Math.abs(dx) / elapsed;
                const threshold = Math.max(COMMIT_PX, window.innerWidth * COMMIT_RATIO);
                const shouldCommit = Math.abs(dx) >= threshold || (Math.abs(dx) > 42 && velocity > 0.55);

                const idx = currentTabIndex();
                let nextIdx = idx;
                const onPortal = document.body.classList.contains('mnav-on-portal');

                if (shouldCommit) {
                    if (onPortal) {
                        // Swipe left on Portal → Templates
                        if (dx < 0) {
                            clearDragStyles(dragSec, false);
                            dragSec = null;
                            goMobileTemplatesFromPortal();
                            return;
                        }
                        clearDragStyles(dragSec, true);
                        dragSec = null;
                        return;
                    }
                    // On Templates, swipe right → Portal
                    if (idx === 0 && dx > 0) {
                        clearDragStyles(dragSec, false);
                        dragSec = null;
                        goMobilePortal();
                        return;
                    }
                    nextIdx = dx < 0
                        ? Math.min(order.length - 1, idx + 1)
                        : Math.max(0, idx - 1);
                }

                if (nextIdx !== idx) {
                    clearDragStyles(dragSec, false);
                    dragSec = null;
                    goMobileClipsTab(order[nextIdx]);
                    return;
                }

                clearDragStyles(dragSec, true);
                dragSec = null;
            }

            root.addEventListener('touchend', finishSwipe, { passive: true });
            root.addEventListener('touchcancel', finishSwipe, { passive: true });
        }

        window.updateMobileClipsPillIndicator = updateMobileClipsPillIndicator;
        window.goMobileClipsTab = goMobileClipsTab;
        window.goMobilePortal = goMobilePortal;
        window.goMobileTemplatesFromPortal = goMobileTemplatesFromPortal;
        window.handleNav = function(el, index) {
            if (!el || el.classList.contains('disabled') || el.disabled) return;
            const target = el.getAttribute('data-target');
            if (target === 'clips') {
                const saved = localStorage.getItem('clipsActiveTab');
                goMobileClipsTab(saved && saved !== 'create' ? saved : 'templates');
                return;
            }
            localStorage.setItem('activeNavIndex', index);
            document.querySelectorAll('.nav-item[data-target]').forEach(i => i.classList.remove('active'));
            el.classList.add('active');
            if (target) switchSection(target);
        };
        window.closeMobileNavMenu = function() {
            const btn = document.getElementById('mnavMenuBtn');
            const sheet = document.getElementById('mnavMenuSheet');
            const backdrop = document.getElementById('mnavMenuBackdrop');
            if (sheet) {
                sheet.hidden = true;
                sheet.classList.remove('is-open');
                sheet.style.display = 'none';
                sheet.setAttribute('aria-hidden', 'true');
            }
            if (backdrop) {
                backdrop.hidden = true;
                backdrop.classList.remove('is-open');
                backdrop.style.display = 'none';
                backdrop.setAttribute('aria-hidden', 'true');
            }
            if (btn) {
                btn.setAttribute('aria-expanded', 'false');
                btn.setAttribute('aria-label', 'Open menu');
            }
        };
        window.openMobileNavMenu = function() {
            const btn = document.getElementById('mnavMenuBtn');
            const sheet = document.getElementById('mnavMenuSheet');
            const backdrop = document.getElementById('mnavMenuBackdrop');
            if (!sheet) return;
            const onPortal = document.body.classList.contains('mnav-on-portal');
            const clipsActive = document.getElementById('clipsContainer')?.classList.contains('active');
            sheet.querySelectorAll('[data-mnav-go]').forEach((el) => {
                const go = el.getAttribute('data-mnav-go');
                const active = go === 'Portal' ? onPortal : (go === 'clips' ? (!onPortal && clipsActive) : false);
                el.classList.toggle('is-active', !!active);
            });
            sheet.hidden = false;
            sheet.classList.add('is-open');
            sheet.style.display = 'flex';
            sheet.setAttribute('aria-hidden', 'false');
            if (backdrop) {
                backdrop.hidden = false;
                backdrop.classList.add('is-open');
                backdrop.style.display = 'block';
                backdrop.setAttribute('aria-hidden', 'false');
            }
            if (btn) {
                btn.setAttribute('aria-expanded', 'true');
                btn.setAttribute('aria-label', 'Close menu');
            }
        };
        window.toggleMobileNavMenu = function(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            if (window.innerWidth > 768) return;
            const sheet = document.getElementById('mnavMenuSheet');
            if (!sheet) return;
            if (sheet.hidden) window.openMobileNavMenu();
            else window.closeMobileNavMenu();
        };
        window.toggleNavWrapperCollapse = function(){};
        window.switchSection = switchSection;

        (function initMobileCreateSheetApi() {
            const PEEK_Y = 48;
            const FULL_Y = 0;
            const DISMISS_Y = 78;
            let sheetY = PEEK_Y;
            let createPackHome = null;
            let dragging = false;
            let dragStartClientY = 0;
            let dragStartSheetY = PEEK_Y;

            function els() {
                return {
                    sheet: document.getElementById('mnavCreateSheet'),
                    backdrop: document.getElementById('mnavCreateBackdrop'),
                    body: document.getElementById('mnavCreateSheetBody'),
                    grab: document.getElementById('mnavCreateGrab'),
                    fab: document.getElementById('mnavCreateFab'),
                };
            }

            function setSheetY(pct) {
                sheetY = Math.max(FULL_Y, Math.min(110, pct));
                const { sheet } = els();
                if (sheet) sheet.style.setProperty('--mnav-sheet-y', `${sheetY}%`);
            }

            function ensureUrlInSheet() {
                const { body } = els();
                if (!body) return;
                // Move full create pack so URL + pills + uc-card all show in the sheet
                const pack = document.querySelector('#createSection .create-content')
                    || document.querySelector('.create-content');
                if (pack) {
                    if (pack.parentElement === body) return;
                    createPackHome = { parent: pack.parentElement, next: pack.nextSibling };
                    body.appendChild(pack);
                    return;
                }
                const url = document.querySelector('.url-input-container');
                if (!url || url.parentElement === body) return;
                createPackHome = { parent: url.parentElement, next: url.nextSibling };
                body.appendChild(url);
            }

            function restoreUrl() {
                const { body } = els();
                const pack = body?.querySelector('.create-content');
                const url = pack || body?.querySelector('.url-input-container');
                if (!url || !createPackHome?.parent) return;
                if (createPackHome.next && createPackHome.next.parentNode === createPackHome.parent) {
                    createPackHome.parent.insertBefore(url, createPackHome.next);
                } else {
                    createPackHome.parent.appendChild(url);
                }
            }

            window.openMobileCreateSheet = function() {
                if (window.innerWidth > 768) return;
                const { sheet, backdrop, fab } = els();
                if (!sheet) return;
                clearTimeout(sheet._mnavCloseT);
                window.closeMobileNavMenu?.();
                ensureUrlInSheet();

                // Mount off-screen first so the rise-in transition can play
                sheet.classList.remove('is-revealed', 'is-dragging');
                sheet.style.transition = 'none';
                setSheetY(110);
                sheet.hidden = false;
                sheet.removeAttribute('hidden');
                sheet.classList.add('is-open');
                sheet.setAttribute('aria-hidden', 'false');
                if (backdrop) {
                    backdrop.hidden = false;
                    backdrop.removeAttribute('hidden');
                    backdrop.classList.add('is-open');
                    backdrop.setAttribute('aria-hidden', 'false');
                }
                fab?.classList.add('is-open');
                fab?.setAttribute('aria-selected', 'true');
                document.body.classList.add('mnav-create-open');
                document.documentElement.style.overflow = 'hidden';

                void sheet.offsetWidth;
                sheet.style.transition = '';
                requestAnimationFrame(() => {
                    setSheetY(PEEK_Y);
                    sheet.classList.add('is-revealed');
                });

                setTimeout(() => {
                    try { document.getElementById('youtubeUrlInput')?.focus?.({ preventScroll: true }); } catch (_) {}
                }, 420);
                if (window.navigator.vibrate) window.navigator.vibrate(8);
            };

            window.closeMobileCreateSheet = function(opts) {
                const immediate = !!(opts && opts.immediate);
                const { sheet, backdrop, fab } = els();
                if (!sheet || (!sheet.classList.contains('is-open') && sheet.hidden)) {
                    fab?.classList.remove('is-open');
                    document.body.classList.remove('mnav-create-open');
                    document.documentElement.style.overflow = '';
                    return;
                }
                clearTimeout(sheet._mnavCloseT);
                sheet.classList.remove('is-dragging', 'is-revealed');
                fab?.classList.remove('is-open');
                fab?.setAttribute('aria-selected', 'false');
                if (backdrop) backdrop.classList.remove('is-open');

                const finish = () => {
                    sheet.classList.remove('is-open', 'is-revealed');
                    sheet.setAttribute('aria-hidden', 'true');
                    sheet.hidden = true;
                    sheet.style.removeProperty('--mnav-sheet-y');
                    sheet.style.transition = '';
                    if (backdrop) {
                        backdrop.hidden = true;
                        backdrop.setAttribute('aria-hidden', 'true');
                    }
                    document.body.classList.remove('mnav-create-open');
                    document.documentElement.style.overflow = '';
                    restoreUrl();
                    sheetY = PEEK_Y;
                };

                if (immediate) {
                    sheet.style.transition = 'none';
                    sheet.style.setProperty('--mnav-sheet-y', '110%');
                    finish();
                    return;
                }

                setSheetY(110);
                sheet._mnavCloseT = setTimeout(finish, 420);
            };

            window.toggleMobileCreateSheet = function(event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                if (window.innerWidth > 768) return;
                const sheet = document.getElementById('mnavCreateSheet');
                if (sheet && !sheet.hidden && sheet.classList.contains('is-open')) {
                    window.closeMobileCreateSheet();
                } else {
                    window.openMobileCreateSheet();
                }
            };

            window.bindMobileCreateSheetUi = function() {
                const { sheet, backdrop, grab, fab, body } = els();
                if (!sheet || sheet.dataset.dragBound === '1') return;
                sheet.dataset.dragBound = '1';

                fab?.addEventListener('click', (e) => window.toggleMobileCreateSheet(e));
                backdrop?.addEventListener('click', () => window.closeMobileCreateSheet());

                let lastY = 0;
                let lastT = 0;
                let vel = 0;
                let winBound = false;

                function unbindWin() {
                    if (!winBound) return;
                    winBound = false;
                    window.removeEventListener('touchmove', onWinMove);
                    window.removeEventListener('touchend', onWinEnd);
                    window.removeEventListener('touchcancel', onWinEnd);
                }

                function onWinMove(e) {
                    if (!dragging || !e.touches?.[0]) return;
                    onMove(e.touches[0].clientY);
                    if (e.cancelable) e.preventDefault();
                }

                function onWinEnd() {
                    unbindWin();
                    onEnd();
                }

                function onStart(clientY) {
                    dragging = true;
                    dragStartClientY = clientY;
                    dragStartSheetY = sheetY;
                    lastY = clientY;
                    lastT = Date.now();
                    vel = 0;
                    sheet.classList.add('is-dragging');
                    if (!winBound) {
                        winBound = true;
                        window.addEventListener('touchmove', onWinMove, { passive: false });
                        window.addEventListener('touchend', onWinEnd, { passive: true });
                        window.addEventListener('touchcancel', onWinEnd, { passive: true });
                    }
                }

                function onMove(clientY) {
                    if (!dragging) return;
                    const now = Date.now();
                    const dt = Math.max(16, now - lastT);
                    vel = (clientY - lastY) / dt;
                    lastY = clientY;
                    lastT = now;
                    const h = sheet.offsetHeight || window.innerHeight;
                    const deltaPct = ((clientY - dragStartClientY) / h) * 100;
                    setSheetY(dragStartSheetY + deltaPct);
                }

                function onEnd() {
                    if (!dragging) return;
                    dragging = false;
                    sheet.classList.remove('is-dragging');
                    unbindWin();
                    if (sheetY >= DISMISS_Y || (sheetY > 62 && vel > 0.45)) {
                        window.closeMobileCreateSheet();
                        return;
                    }
                    if (sheetY <= 26 || (vel < -0.45 && sheetY < 55)) {
                        setSheetY(FULL_Y);
                    } else {
                        setSheetY(PEEK_Y);
                    }
                }

                function tryStartFromEvent(e) {
                    if (!sheet.classList.contains('is-open')) return;
                    if (!e.touches?.[0]) return;
                    onStart(e.touches[0].clientY);
                }

                grab?.addEventListener('touchstart', tryStartFromEvent, { passive: true });
                body?.addEventListener('touchstart', (e) => {
                    if (!sheet.classList.contains('is-open')) return;
                    if (body.scrollTop > 2) return;
                    const t = e.target;
                    if (t && t.closest && t.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
                    tryStartFromEvent(e);
                }, { passive: true });

                grab?.addEventListener('pointerdown', (e) => {
                    if (e.pointerType === 'touch') return;
                    if (!sheet.classList.contains('is-open')) return;
                    if (e.button !== 0) return;
                    e.preventDefault();
                    onStart(e.clientY);
                    const move = (ev) => onMove(ev.clientY);
                    const up = () => {
                        onEnd();
                        window.removeEventListener('pointermove', move);
                        window.removeEventListener('pointerup', up);
                        window.removeEventListener('pointercancel', up);
                    };
                    window.addEventListener('pointermove', move);
                    window.addEventListener('pointerup', up);
                    window.addEventListener('pointercancel', up);
                });
            };
        })();

        document.addEventListener('DOMContentLoaded', function() {
            initMobileClipsSwipe();
            window.bindMobileCreateSheetUi?.();

            function syncMobileProfileInNav() {
                const cluster = document.getElementById('profileActionCluster');
                const wr = document.getElementById('profileDropdownWr');
                const notif = document.getElementById('notifWrapper')
                    || document.querySelector('.profile-action-cluster > .notif-wrapper')
                    || document.getElementById('bellBtn')?.closest('.notif-wrapper');
                const nav = document.getElementById('navWrapper');
                const host = document.querySelector('.profile-notif-wrapper');
                if (!nav || !host) return;
                const mobile = window.innerWidth <= 768;
                const pill = nav.querySelector('.clips-sub-pill');
                let side = document.getElementById('mnavSideActions')
                    || nav.querySelector('.mnav-side-actions');

                if (mobile) {
                    const dock = pill?.querySelector('.clips-sub-side--right') || pill || nav;
                    if (!side) {
                        side = document.createElement('div');
                        side.className = 'mnav-side-actions';
                        side.id = 'mnavSideActions';
                        dock.appendChild(side);
                    } else if (side.parentElement !== dock) {
                        dock.appendChild(side);
                    }
                    // Profile only — no hamburger menu
                    document.getElementById('mnavMenuBtn')?.remove();
                    if (cluster && cluster.parentElement !== side) {
                        side.appendChild(cluster);
                        document.getElementById('notificationsDropdown')?.classList.remove('open');
                        document.getElementById('profileDropdown')?.classList.remove('open');
                    } else {
                        if (wr && wr.parentElement !== side && !cluster) {
                            side.appendChild(wr);
                            document.getElementById('profileDropdown')?.classList.remove('open');
                        }
                    }
                    side.querySelectorAll('.mnav-profile-label').forEach((el) => el.remove());
                } else {
                    window.closeMobileNavMenu?.();
                    window.closeMobileCreateSheet?.();
                    if (cluster && cluster.parentElement !== host) {
                        host.appendChild(cluster);
                        document.getElementById('profileDropdown')?.classList.remove('open');
                        document.getElementById('notificationsDropdown')?.classList.remove('open');
                    } else {
                        if (notif && notif.parentElement !== host && !cluster) {
                            const gen = host.querySelector('.generation-progress-wrapper');
                            if (gen && gen.nextSibling) host.insertBefore(notif, gen.nextSibling);
                            else if (wr && wr.parentElement === host) host.insertBefore(notif, wr);
                            else host.appendChild(notif);
                        }
                        if (wr && wr.parentElement !== host && !cluster) {
                            host.appendChild(wr);
                            document.getElementById('profileDropdown')?.classList.remove('open');
                        }
                    }
                    side?.querySelectorAll('.mnav-profile-label').forEach((el) => el.remove());
                }
            }
            syncMobileProfileInNav();
            window.addEventListener('resize', syncMobileProfileInNav);
            window.syncMobileProfileInNav = syncMobileProfileInNav;

            const mnavMenuBtn = document.getElementById('mnavMenuBtn');
            const mnavMenuBackdrop = document.getElementById('mnavMenuBackdrop');
            const mnavMenuSheet = document.getElementById('mnavMenuSheet');
            if (mnavMenuBtn) {
                mnavMenuBtn.addEventListener('click', (e) => window.toggleMobileNavMenu(e));
            }
            if (mnavMenuBackdrop) {
                mnavMenuBackdrop.addEventListener('click', () => window.closeMobileNavMenu());
            }
            if (mnavMenuSheet) {
                mnavMenuSheet.querySelectorAll('[data-mnav-go]').forEach((el) => {
                    el.addEventListener('click', () => {
                        if (el.disabled || el.classList.contains('is-disabled')) return;
                        const go = el.getAttribute('data-mnav-go');
                        window.closeMobileNavMenu();
                        if (go === 'Portal') {
                            goMobilePortal();
                            return;
                        }
                        if (go === 'clips') {
                            const saved = localStorage.getItem('clipsActiveTab');
                            goMobileClipsTab(saved && saved !== 'create' ? saved : 'templates');
                            return;
                        }
                        const navItem = document.querySelector(`.nav-item[data-target="${go}"]`);
                        if (navItem && typeof window.navigate === 'function') {
                            window.navigate(navItem, Number(navItem.dataset.index || 0));
                        } else if (go) {
                            switchSection(go);
                        }
                    });
                });
            }
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    window.closeMobileCreateSheet?.();
                    window.closeMobileNavMenu?.();
                }
            });

            // Prefer templates on mobile — Create is a sheet, not a landing tab
            const wrapSwitchClipsTab = () => {
                if (typeof window.switchClipsTab !== 'function' || window.switchClipsTab._mnavCreateWrapped) return;
                const orig = window.switchClipsTab;
                const wrapped = function(tabName, buttonElement) {
                    if (tabName === 'create' && window.innerWidth <= 768) {
                        window.openMobileCreateSheet?.();
                        return;
                    }
                    if (window.innerWidth <= 768 && tabName !== 'create') {
                        window.closeMobileCreateSheet?.();
                    }
                    return orig.call(this, tabName, buttonElement);
                };
                wrapped._mnavCreateWrapped = true;
                window.switchClipsTab = wrapped;
            };
            wrapSwitchClipsTab();
            setTimeout(wrapSwitchClipsTab, 0);
            setTimeout(wrapSwitchClipsTab, 400);

            // Portal page swipe → Templates
            const portalRoot = document.getElementById('portalContainer');
            if (portalRoot && !portalRoot.dataset.portalSwipeBound) {
                portalRoot.dataset.portalSwipeBound = '1';
                let sx = 0, sy = 0, st = 0, tracking = false, axis = null;
                portalRoot.addEventListener('touchstart', (e) => {
                    if (window.innerWidth > 768 || !document.body.classList.contains('mnav-on-portal')) return;
                    if (_mnavSectionAnimating) return;
                    if (!e.touches || e.touches.length !== 1) return;
                    const t = e.target;
                    if (t && t.closest && t.closest(
                        'input, textarea, select, [contenteditable="true"],' +
                        '.stgModal, .mobile-clips-bar, .clips-sub-nav, .profile-dropdown-wr,' +
                        '.mnav-side-actions, .notif-wrapper'
                    )) {
                        tracking = false;
                        return;
                    }
                    sx = e.touches[0].clientX;
                    sy = e.touches[0].clientY;
                    st = Date.now();
                    tracking = true;
                    axis = null;
                }, { passive: true });
                portalRoot.addEventListener('touchmove', (e) => {
                    if (!tracking) return;
                    const dx = e.touches[0].clientX - sx;
                    const dy = e.touches[0].clientY - sy;
                    if (!axis) {
                        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
                        axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
                    }
                    if (axis === 'x' && Math.abs(dx) > 16) e.preventDefault();
                }, { passive: false });
                portalRoot.addEventListener('touchend', (e) => {
                    if (!tracking) return;
                    tracking = false;
                    if (axis !== 'x') return;
                    const dx = (e.changedTouches?.[0]?.clientX ?? sx) - sx;
                    const elapsed = Math.max(16, Date.now() - st);
                    const velocity = Math.abs(dx) / elapsed;
                    // Swipe left → Templates
                    if (dx < -72 || (dx < -42 && velocity > 0.55)) {
                        goMobileTemplatesFromPortal();
                    }
                }, { passive: true });
            }
            if (window.innerWidth <= 768) {
                const saved = localStorage.getItem('clipsActiveTab');
                const startTab = saved && saved !== 'create' ? saved : 'templates';
                goMobileClipsTab(startTab);
                requestAnimationFrame(() => updateMobileClipsPillIndicator(startTab));
            }
            window.addEventListener('resize', () => {
                if (window.innerWidth <= 768) updateMobileClipsPillIndicator();
            });
        });
})(); // End scope wrapper IIFE