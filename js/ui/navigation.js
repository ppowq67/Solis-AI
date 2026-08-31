// Default dashboard home → Clips / Create (paste URL). Once per page load only —
// never re-force after the user navigates away.
window.SolisFirstLanding = window.SolisFirstLanding || {
    prefix: 'solis_seen_create_landing_',
    _appliedThisLoad: false,
    userId: function () {
        try {
            const u = window.currentUser;
            return (u && (u.id || u.user_id)) || null;
        } catch (_) {
            return null;
        }
    },
    key: function (uid) {
        return this.prefix + String(uid || '');
    },
    hasSeen: function () {
        return !!this._appliedThisLoad;
    },
    markSeen: function () {
        this._appliedThisLoad = true;
    },
    needsLanding: function () {
        return !this._appliedThisLoad;
    },
    applyCreateLanding: function () {
        if (this._appliedThisLoad) return;
        this._appliedThisLoad = true;
        try {
            localStorage.setItem('currentNavigationTarget', 'clips');
            localStorage.setItem('clipsStudioCurrentTab', 'create');
            localStorage.setItem('clipsActiveTab', 'create');
            // Keep sidebar restore in sync with Clips (nav index 2)
            localStorage.setItem('sidebarActiveIndex', '2');
            localStorage.setItem('activeNavIndex', '2');
        } catch (_) {}
        if (typeof window.switchSection === 'function') {
            try { window.switchSection('clips'); } catch (_) {}
        }
        const clipsNav = document.querySelector('.nav-item[data-target="clips"]');
        if (clipsNav) {
            document.querySelectorAll('.nav-item[data-target]').forEach((i) => i.classList.remove('active'));
            clipsNav.classList.add('active');
        }
        if (typeof window.switchClipsTab === 'function') {
            const btn = document.querySelector('.clips-tab[data-tab="create"], .clips-sub-item[data-tab="create"]');
            try { window.switchClipsTab('create', btn); } catch (_) {}
        }
        if (window.clipsStudio && typeof window.clipsStudio.goToCreateUrlSubmit === 'function') {
            window.clipsStudio.goToCreateUrlSubmit();
        } else if (typeof window.goToCreateUrlSubmit === 'function') {
            window.goToCreateUrlSubmit();
        }
        if (typeof window.updateMobileClipsPillIndicator === 'function') {
            try { window.updateMobileClipsPillIndicator('create'); } catch (_) {}
        }
    },
};

// Navigation Handler
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const portalContainer = document.getElementById('portalContainer');
    const clipsContainer = document.getElementById('clipsContainer');
    const customEditorContainer = document.getElementById('customEditorContainer');
    const inputSection = document.querySelector('.input-section');

    // Helper: hide everything
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

    // Helper: update active navigation
    function updateActiveNav(target) {
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-target') === target) {
                item.classList.add('active');
            }
        });
    }

    // Default home: Clips → Create (once). User can leave freely after.
    hideAll();
    try {
        if (window.SolisFirstLanding && typeof window.SolisFirstLanding.applyCreateLanding === 'function') {
            window.SolisFirstLanding.applyCreateLanding();
        } else if (clipsContainer) {
            localStorage.setItem('currentNavigationTarget', 'clips');
            clipsContainer.style.display = 'block';
            clipsContainer.classList.add('active');
            updateActiveNav('clips');
            if (typeof window.clipsStudio !== 'undefined' && window.clipsStudio && !window.clipsStudio.initialized) {
                window.clipsStudio.init();
            }
        } else if (portalContainer) {
            portalContainer.style.display = 'block';
            portalContainer.classList.add('active');
            updateActiveNav('Portal');
        }
    } catch (_) {
        if (clipsContainer) {
            clipsContainer.style.display = 'block';
            clipsContainer.classList.add('active');
            updateActiveNav('clips');
        }
    }
    
    // Always hide input section
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

            // Update navigation active states
            updateActiveNav(rawTarget);

            // Hide everything then show the requested container
            hideAll();
            // Always hide input section
            if (inputSection) {
                inputSection.style.cssText = 'display: none !important; position: absolute !important; visibility: hidden !important; z-index: -10000 !important; pointer-events: none !important;';
                inputSection.classList.remove('is-first-prompt');
            }

            if (target === 'dashboard') {
                localStorage.setItem('currentNavigationTarget', 'dashboard');
                if (dashboardContainer) {
                    dashboardContainer.style.display = 'block';
                    dashboardContainer.classList.add('active');
                    
                    // Trigger chart rendering when dashboard becomes visible
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
                    
                    // Initialize Clips Studio if it exists and hasn't been initialized
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

    // Handle clips submenu toggle
    const clipsToggle = document.getElementById('clips-toggle');
    if (clipsToggle) {
        clipsToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const submenu = document.getElementById('clips-submenu');
            const chevron = this.querySelector('.chevron-icon');
            
            if (submenu) submenu.classList.toggle('open');
            if (chevron) chevron.classList.toggle('rotated');
            
            // If clicking the main clips item, navigate to clips
            if (!submenu || !submenu.contains(e.target)) {
                const clipsContainer = document.getElementById('clipsContainer');
                const inputSection = document.querySelector('.input-section');
                
                // Hide other containers
                document.querySelectorAll('.dashboard-container, .portal-container').forEach(container => {
                    container.style.display = 'none';
                    container.classList.remove('active');
                });
                
                // Show clips container
                if (clipsContainer) {
                    clipsContainer.style.display = 'block';
                    clipsContainer.classList.add('active');
                    
                    // Initialize Clips Studio if needed
                    if (typeof window.clipsStudio !== 'undefined' && window.clipsStudio && !window.clipsStudio.initialized) {
                        window.clipsStudio.init();
                    }
                }
                
                // Hide input section
                if (inputSection) {
                    inputSection.style.display = 'none';
                    try {
                        if (typeof window.dockInputInstantly === 'function') window.dockInputInstantly(true);
                    } catch (e) {
                        console.error('Error docking input:', e);
                    }
                }
                
                // Update active navigation
                updateActiveNav('clips');
            }
        });
    }

    // Handle clips submenu items
    const clipsSubmenuItems = document.querySelectorAll('.clips-submenu .nav-item');
    clipsSubmenuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target');
            
            if (target === 'clips-studio') {
                const clipsContainer = document.getElementById('clipsContainer');
                const inputSection = document.querySelector('.input-section');
                
                // Hide other containers
                document.querySelectorAll('.dashboard-container, .portal-container').forEach(container => {
                    container.style.display = 'none';
                    container.classList.remove('active');
                });
                
                // Show clips container
                if (clipsContainer) {
                    clipsContainer.style.display = 'block';
                    clipsContainer.classList.add('active');
                    
                    // Initialize Clips Studio if needed
                    if (typeof window.clipsStudio !== 'undefined' && window.clipsStudio && !window.clipsStudio.initialized) {
                        window.clipsStudio.init();
                    }
                }
                
                // Hide input section
                if (inputSection) {
                    inputSection.style.display = 'none';
                    try {
                        if (typeof window.dockInputInstantly === 'function') window.dockInputInstantly(true);
                    } catch (e) {
                        console.error('Error docking input:', e);
                    }
                }
                
                // Update active navigation
                updateActiveNav('clips');
                
                // Close submenu
                const submenu = document.getElementById('clips-submenu');
                const chevron = document.querySelector('#clips-toggle .chevron-icon');
                if (submenu) submenu.classList.remove('open');
                if (chevron) chevron.classList.remove('rotated');
            }
        });
    });

    // Close submenus when clicking outside
    document.addEventListener('click', function(e) {
        const clipsToggle = document.getElementById('clips-toggle');
        const clipsSubmenu = document.getElementById('clips-submenu');
        
        if (clipsSubmenu && clipsToggle && !clipsToggle.contains(e.target) && !clipsSubmenu.contains(e.target)) {
            clipsSubmenu.classList.remove('open');
            const chevron = clipsToggle.querySelector('.chevron-icon');
            if (chevron) chevron.classList.remove('rotated');
        }
    });

    // Handle Portal navigation specifically
    const portalNavItem = document.querySelector('.nav-item[data-target="Portal"]');
    if (portalNavItem) {
        portalNavItem.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get containers
            const portalContainer = document.getElementById('portalContainer');
            const dashboardContainer = document.getElementById('dashboardContainer');
            const clipsContainer = document.getElementById('clipsContainer');
            const inputSection = document.querySelector('.input-section');
            
            // Hide all containers
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
            
            // Show portal
            if (portalContainer) {
                portalContainer.style.display = 'block';
                portalContainer.classList.add('active');
            }
            
            // Update active nav
            updateActiveNav('Portal');
        });
    }


    // Handle sidebar toggle with keyboard shortcut
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to toggle sidebar
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

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    // DOM already loaded
    initNavigation();
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initNavigation };
}