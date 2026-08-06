(function() {
    let currentIndex = 0;
    let resetTimeout;
    let indicatorObserver;

        const updateIndicator = (activeElement) => {
        };

        function initSidebarState() {
            try {
                const navContainer = document.getElementById('navContainer');
                if (!navContainer) return;

                const savedIndex = localStorage.getItem('sidebarActiveIndex');
                const items = navContainer.querySelectorAll('.nav-item');
                const parsedIndex = savedIndex !== null ? parseInt(savedIndex, 10) : -1;
                const savedItem = parsedIndex >= 0 ? items[parsedIndex] : null;

                if (savedItem && !savedItem.classList.contains('disabled')) {
                    currentIndex = parsedIndex;
                    items.forEach(item => item.classList.remove('active'));
                    savedItem.classList.add('active');
                    setTimeout(() => updateIndicator(savedItem), 0);
                    const target = savedItem.getAttribute('data-target');
                    if (target) switchSection(target);
                } else {
                    const firstValid = Array.from(items).find(item => !item.classList.contains('disabled'));
                    if (firstValid) {
                        currentIndex = Array.from(items).indexOf(firstValid);
                        items.forEach(item => item.classList.remove('active'));
                        firstValid.classList.add('active');
                        setTimeout(() => updateIndicator(firstValid), 0);
                        const target = firstValid.getAttribute('data-target');
                        if (target) switchSection(target);
                    }
                    if (savedItem && savedItem.classList.contains('disabled')) {
                        localStorage.removeItem('sidebarActiveIndex');
                    }
                }
            } catch (err) {
                console.error('Failed to restore sidebar state:', err);
            }
        }

        function initIndicatorTracking() {
            const navContainer = document.getElementById('navContainer');
            if (!navContainer) return;

            const initialActive = navContainer.querySelector('.nav-item.active');
            if (initialActive) {
                updateIndicator(initialActive);
            }

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
                const pageHost = window.location.host;  // This will be 127.0.0.1:5500 or localhost:5500
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const socketUrl = `${protocol}//${pageHost}`;  // Use exact same host as page

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

            items.forEach(item => item.classList.remove('active'));

            element.classList.add('active');
            currentIndex = index;

            updateIndicator(element);

            try {
                localStorage.setItem('sidebarActiveIndex', index);
            } catch (err) {
                console.error('Failed to save sidebar state:', err);
            }

            const target = element.getAttribute('data-target');
            if (target) {
                switchSection(target);
            }
        }

        window.navigate = navigate;

        let _mnavSectionAnimating = false;

        function switchSection(target, opts) {
            const options = opts || {};
            const skipHide = options.keepVisible || null; // element to keep visible during anim
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
                goMobileClipsTab('templates');
                return;
            }
            if (alreadyThere && toPortal) return;

            _mnavSectionAnimating = true;

            incoming.style.display = 'block';
            incoming.classList.add('active', 'mnav-section-anim');
            outgoing.classList.add('mnav-section-anim');
            void incoming.offsetWidth;

            incoming.classList.add(toPortal ? 'mnav-enter-from-left' : 'mnav-enter-from-right');
            outgoing.classList.add(toPortal ? 'mnav-exit-to-right' : 'mnav-exit-to-left');

            document.body.classList.toggle('mnav-on-portal', toPortal);
            if (toPortal) {
                try { localStorage.setItem('currentNavigationTarget', 'Portal'); } catch (_) {}
                const portalItem = document.querySelector('.nav-item[data-target="Portal"]');
                document.querySelectorAll('.nav-item[data-target]').forEach((i) => i.classList.remove('active'));
                portalItem?.classList.add('active');
                document.querySelectorAll('.clips-sub-item').forEach((b) => b.classList.remove('active'));
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
            transitionPortalTemplates(true);
        }

        function goMobileTemplatesFromPortal() {
            transitionPortalTemplates(false);
        }

        function updateMobileClipsPillIndicator(tabName) {
            const indicator = document.getElementById('clipsSubPane');
            const pill = document.querySelector('.clips-sub-pill');
            if (!indicator || !pill || window.innerWidth > 768) return;
            const tab = tabName
                || document.querySelector('.clips-sub-item.active')?.getAttribute('data-tab')
                || localStorage.getItem('clipsActiveTab')
                || 'templates';
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

            if (window.innerWidth <= 768
                && document.body.classList.contains('mnav-on-portal')
                && tabName === 'templates') {
                transitionPortalTemplates(false);
                return;
            }

            const order = ['templates', 'create', 'library'];
            const prevTab = document.querySelector('.clips-sub-item.active')?.getAttribute('data-tab')
                || localStorage.getItem('clipsActiveTab')
                || 'templates';
            const fromIdx = order.indexOf(prevTab);
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

            const order = ['templates', 'create', 'library'];
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
                const activeBtn = document.querySelector('.clips-sub-item.active');
                const cur = activeBtn?.getAttribute('data-tab')
                    || localStorage.getItem('clipsActiveTab')
                    || 'templates';
                return order.indexOf(cur);
            }

            root.addEventListener('touchstart', (e) => {
                if (window.innerWidth > 768) return;
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
                goMobileClipsTab(localStorage.getItem('clipsActiveTab') || 'templates');
                return;
            }
            localStorage.setItem('activeNavIndex', index);
            document.querySelectorAll('.nav-item[data-target]').forEach(i => i.classList.remove('active'));
            el.classList.add('active');
            if (target) switchSection(target);
        };
        window.closeMobileNavMenu = function(){};
        window.openMobileNavMenu = function(){};
        window.toggleMobileNavMenu = function(){};
        window.toggleNavWrapperCollapse = function(){};
        window.switchSection = switchSection;

        document.addEventListener('DOMContentLoaded', function() {
            initMobileClipsSwipe();

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
                let side = document.getElementById('mnavSideActions')
                    || nav.querySelector('.mnav-side-actions');

                if (mobile) {
                    if (!side) {
                        side = document.createElement('div');
                        side.className = 'mnav-side-actions';
                        side.id = 'mnavSideActions';
                        nav.appendChild(side);
                    } else if (side.parentElement !== nav) {
                        nav.appendChild(side);
                    }
                    if (cluster && cluster.parentElement !== side) {
                        side.appendChild(cluster);
                        document.getElementById('notificationsDropdown')?.classList.remove('open');
                        document.getElementById('profileDropdown')?.classList.remove('open');
                    } else {
                        if (notif && notif.parentElement !== side && !cluster) {
                            side.appendChild(notif);
                            document.getElementById('notificationsDropdown')?.classList.remove('open');
                        }
                        if (wr && wr.parentElement !== side && !cluster) {
                            side.appendChild(wr);
                            document.getElementById('profileDropdown')?.classList.remove('open');
                        }
                    }
                } else {
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
                    if (side && !side.children.length) side.remove();
                }
            }
            syncMobileProfileInNav();
            window.addEventListener('resize', syncMobileProfileInNav);
            window.syncMobileProfileInNav = syncMobileProfileInNav;

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
                    if (dx < -72 || (dx < -42 && velocity > 0.55)) {
                        goMobileTemplatesFromPortal();
                    }
                }, { passive: true });
            }
            if (window.innerWidth <= 768) {
                const tab = localStorage.getItem('clipsActiveTab') || 'templates';
                goMobileClipsTab(tab);
                requestAnimationFrame(() => updateMobileClipsPillIndicator(tab));
            }
            window.addEventListener('resize', () => {
                if (window.innerWidth <= 768) updateMobileClipsPillIndicator();
            });
        });
})(); // End scope wrapper IIFE
