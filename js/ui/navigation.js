function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const portalContainer = document.getElementById('portalContainer');
    const clipsContainer = document.getElementById('clipsContainer');
    const customEditorContainer = document.getElementById('customEditorContainer');
    const inputSection = document.querySelector('.input-section');

    function hideAll() {
        if (dashboardContainer) {
            dashboardContainer.style.display = 'none';
            dashboardContainer.classList.remove('active');
        }
        if (portalContainer) {
            portalContainer.style.display = 'none';
            portalContainer.classList.remove('active');
        }
        if (clipsContainer) {
            clipsContainer.style.display = 'none';
            clipsContainer.classList.remove('active');
        }
        if (customEditorContainer) {
            customEditorContainer.style.display = 'none';
            customEditorContainer.classList.remove('active');
        }
    }

    function updateActiveNav(target) {
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-target') === target) {
                item.classList.add('active');
            }
        });
    }

    hideAll();

    const savedTarget = localStorage.getItem('currentNavigationTarget');
    if (savedTarget === 'dashboard') {
        localStorage.removeItem('currentNavigationTarget');
    }
    const validSaved = savedTarget && savedTarget !== 'dashboard' && ['portal', 'Portal', 'clips', 'custom'].includes(savedTarget) ? savedTarget : null;
    const isMobileNav = window.innerWidth <= 768;
    let initialTarget = validSaved || (isMobileNav ? 'clips' : 'Portal');
    if (isMobileNav && (initialTarget === 'Portal' || initialTarget === 'portal')) {
        initialTarget = 'clips';
    }

    if ((initialTarget === 'Portal' || initialTarget === 'portal') && portalContainer) {
        portalContainer.style.display = 'block';
        portalContainer.classList.add('active');
        updateActiveNav('Portal');
    } else if (initialTarget === 'clips' && clipsContainer) {
        clipsContainer.style.display = 'block';
        clipsContainer.classList.add('active');
        updateActiveNav('clips');
        if (typeof window.clipsStudio !== 'undefined' && window.clipsStudio && !window.clipsStudio.initialized) {
            window.clipsStudio.init();
        }
    } else if (initialTarget === 'custom' && customEditorContainer) {
        customEditorContainer.style.display = 'block';
        customEditorContainer.classList.add('active');
        updateActiveNav('Custom');
    } else {
        if (portalContainer) {
            portalContainer.style.display = 'block';
            portalContainer.classList.add('active');
        }
        updateActiveNav('Portal');
    }

    if (inputSection) {
        inputSection.style.cssText = 'display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;';
        inputSection.classList.remove('is-first-prompt');
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            if (item.classList.contains('disabled')) return;
            const rawTarget = item.getAttribute('data-target') || '';
            const target = String(rawTarget).toLowerCase();

            updateActiveNav(rawTarget);

            hideAll();
            if (inputSection) {
                inputSection.style.cssText = 'display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;';
                inputSection.classList.remove('is-first-prompt');
            }

            if (target === 'dashboard') {
                localStorage.setItem('currentNavigationTarget', 'dashboard');
                if (dashboardContainer) {
                    dashboardContainer.style.display = 'block';
                    dashboardContainer.classList.add('active');

                    if (window.analyticsManager) {
                        setTimeout(() => {
                            window.analyticsManager.updateCharts();
                        }, 50);
                    }
                }
                if (inputSection) {
                    inputSection.style.display = 'none';
                    try {
                        if (typeof window.dockInputInstantly === 'function') window.dockInputInstantly(true);
                    } catch (e) {
                        console.error('Error docking input:', e);
                    }
                }
            } else if (target === 'portal') {
                localStorage.setItem('currentNavigationTarget', 'portal');
                if (portalContainer) {
                    portalContainer.style.display = 'block';
                    portalContainer.classList.add('active');
                }
                if (inputSection) {
                    inputSection.style.cssText = 'display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;';
                    inputSection.classList.remove('is-first-prompt');
                    try {
                        if (typeof window.dockInputInstantly === 'function') window.dockInputInstantly(true);
                    } catch (e) {
                        console.error('Error docking input:', e);
                    }
                }
            } else if (target === 'clips' || target === 'clips-studio' || target === 'clipscontainer') {
                localStorage.setItem('currentNavigationTarget', 'clips');
                if (clipsContainer) {
                    clipsContainer.style.display = 'block';
                    clipsContainer.classList.add('active');

                    if (typeof window.clipsStudio !== 'undefined' && window.clipsStudio && !window.clipsStudio.initialized) {
                        window.clipsStudio.init();
                    }
                }
                if (inputSection) {
                    inputSection.style.cssText = 'display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;';
                    inputSection.classList.remove('is-first-prompt');
                    try {
                        if (typeof window.dockInputInstantly === 'function') window.dockInputInstantly(true);
                    } catch (e) {
                        console.error('Error docking input:', e);
                    }
                }
            } else if (target === 'custom-edit' || target === 'custom') {
                localStorage.setItem('currentNavigationTarget', 'custom');
                if (customEditorContainer) {
                    customEditorContainer.style.display = 'block';
                    customEditorContainer.classList.add('active');
                }
                if (inputSection) {
                    inputSection.style.cssText = 'display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;';
                    inputSection.classList.remove('is-first-prompt');
                    try {
                        if (typeof window.dockInputInstantly === 'function') window.dockInputInstantly(true);
                    } catch (e) {
                        console.error('Error docking input:', e);
                    }
                }
            }
        });
    });

    const clipsToggle = document.getElementById('clips-toggle');
    if (clipsToggle) {
        clipsToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const submenu = document.getElementById('clips-submenu');
            const chevron = this.querySelector('.chevron-icon');

            if (submenu) submenu.classList.toggle('open');
            if (chevron) chevron.classList.toggle('rotated');

            if (!submenu || !submenu.contains(e.target)) {
                const clipsContainer = document.getElementById('clipsContainer');
                const inputSection = document.querySelector('.input-section');

                document.querySelectorAll('.dashboard-container, .portal-container').forEach(container => {
                    container.style.display = 'none';
                    container.classList.remove('active');
                });

                if (clipsContainer) {
                    clipsContainer.style.display = 'block';
                    clipsContainer.classList.add('active');

                    if (typeof window.clipsStudio !== 'undefined' && window.clipsStudio && !window.clipsStudio.initialized) {
                        window.clipsStudio.init();
                    }
                }

                if (inputSection) {
                    inputSection.style.display = 'none';
                    try {
                        if (typeof window.dockInputInstantly === 'function') window.dockInputInstantly(true);
                    } catch (e) {
                        console.error('Error docking input:', e);
                    }
                }

                updateActiveNav('clips');
            }
        });
    }

    const clipsSubmenuItems = document.querySelectorAll('.clips-submenu .nav-item');
    clipsSubmenuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target');

            if (target === 'clips-studio') {
                const clipsContainer = document.getElementById('clipsContainer');
                const inputSection = document.querySelector('.input-section');

                document.querySelectorAll('.dashboard-container, .portal-container').forEach(container => {
                    container.style.display = 'none';
                    container.classList.remove('active');
                });

                if (clipsContainer) {
                    clipsContainer.style.display = 'block';
                    clipsContainer.classList.add('active');

                    if (typeof window.clipsStudio !== 'undefined' && window.clipsStudio && !window.clipsStudio.initialized) {
                        window.clipsStudio.init();
                    }
                }

                if (inputSection) {
                    inputSection.style.display = 'none';
                    try {
                        if (typeof window.dockInputInstantly === 'function') window.dockInputInstantly(true);
                    } catch (e) {
                        console.error('Error docking input:', e);
                    }
                }

                updateActiveNav('clips');

                const submenu = document.getElementById('clips-submenu');
                const chevron = document.querySelector('#clips-toggle .chevron-icon');
                if (submenu) submenu.classList.remove('open');
                if (chevron) chevron.classList.remove('rotated');
            }
        });
    });

    document.addEventListener('click', function(e) {
        const clipsToggle = document.getElementById('clips-toggle');
        const clipsSubmenu = document.getElementById('clips-submenu');

        if (clipsSubmenu && clipsToggle && !clipsToggle.contains(e.target) && !clipsSubmenu.contains(e.target)) {
            clipsSubmenu.classList.remove('open');
            const chevron = clipsToggle.querySelector('.chevron-icon');
            if (chevron) chevron.classList.remove('rotated');
        }
    });

    const portalNavItem = document.querySelector('.nav-item[data-target="Portal"]');
    if (portalNavItem) {
        portalNavItem.addEventListener('click', function(e) {
            e.preventDefault();

            const portalContainer = document.getElementById('portalContainer');
            const dashboardContainer = document.getElementById('dashboardContainer');
            const clipsContainer = document.getElementById('clipsContainer');
            const inputSection = document.querySelector('.input-section');

            if (dashboardContainer) {
                dashboardContainer.style.display = 'none';
                dashboardContainer.classList.remove('active');
            }
            if (clipsContainer) {
                clipsContainer.style.display = 'none';
                clipsContainer.classList.remove('active');
            }
            if (inputSection) {
                inputSection.style.display = 'none';
            }

            if (portalContainer) {
                portalContainer.style.display = 'block';
                portalContainer.classList.add('active');
            }

            updateActiveNav('Portal');
        });
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.toggle('expanded');
                const isExpanded = sidebar.classList.contains('expanded');
                localStorage.setItem('sidebarExpanded', isExpanded);
            }
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    initNavigation();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initNavigation };
}
