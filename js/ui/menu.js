let userMenuPanel, userMenuBackdrop;

function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) return false;
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') || !trimmed.includes(':');
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;  // textContent is XSS-safe
    return div.innerHTML;
}

const apiCache = {
    userProfile: null,
    userProfileTime: 0,
    userProfileETag: null,  // Store ETag for conditional requests
    CACHE_DURATION: 1800000, // 30 minutes - reduced server load significantly

    pendingProfileRequest: null,

    getUserProfile() {
        const now = Date.now();
        if (this.userProfile && (now - this.userProfileTime) < this.CACHE_DURATION) {
            return this.userProfile;
        }
        return null;
    },

    setUserProfile(data, etag) {
        this.userProfile = data;
        this.userProfileTime = Date.now();
        this.userProfileETag = etag;
    },

    getETag() {
        return this.userProfileETag;
    },

    getPendingRequest() {
        return this.pendingProfileRequest;
    },

    setPendingRequest(promise) {
        this.pendingProfileRequest = promise;
    },

    clearPendingRequest() {
        this.pendingProfileRequest = null;
    }
};

async function loadAndSetCurrentUser() {
    try {
        if (window.currentUser && userProfileIsComplete(window.currentUser)) {
            if (!window.currentUser.auth_provider) {
                await fetchAndAddAuthProvider();
            }
            return;
        }

        const cachedProfile = apiCache.getUserProfile();
        if (cachedProfile) {
            window.currentUser = cachedProfile;
            updateMenuUserInfo();
            setTimeout(() => updateProfileButton(), 50);
            return;
        }

        localStorage.removeItem('currentUser');

        const pendingRequest = apiCache.getPendingRequest();
        if (pendingRequest) {
            const userData = await pendingRequest;
            if (userData) {
                window.currentUser = userData;
                updateMenuUserInfo();
                setTimeout(() => updateProfileButton(), 50);
            }
            return;
        }

        let headers = {};
        if (typeof getAuthHeaders === 'function') {
            headers = getAuthHeaders();
        }

        const etag = apiCache.getETag();
        if (etag) {
            headers['If-None-Match'] = etag;
        } else {
        }

        const fetchPromise = (async () => {
            try {
                const response = await window.apiRequestCache.dedupFetch(window.apiUrl('/api/user/profile'), {
                    method: 'POST',
                    headers: headers,
                    credentials: 'include',
                    body: JSON.stringify({})
                });

                if (response.status === 304) {
                    const cachedData = apiCache.getUserProfile();
                    if (cachedData) {
                        return cachedData;
                    }
                }

                if (response.status === 401) {
                    console.warn('[401] Profile fetch unauthorized after retry');
                    apiCache.userProfile = null;
                    apiCache.userProfileETag = null;
                    window.currentUser = null;
                    return null;
                }

                if (response.ok) {
                    const userData = await response.json();

                    const responseETag = response.headers.get('ETag');
                    if (responseETag) {
                        apiCache.setUserProfile(userData, responseETag);
                    } else {
                        apiCache.setUserProfile(userData, null);
                    }

                    window.currentUser = userData;
                    localStorage.setItem('currentUser', JSON.stringify(userData));
                    updateMenuUserInfo();
                    setTimeout(() => updateProfileButton(), 100);
                    return userData;
                } else {
                    console.warn('Failed to fetch user profile:', response.status);
                    await fetchAndAddAuthProvider();
                    updateMenuUserInfo();
                    setTimeout(() => updateProfileButton(), 100);
                }
            } catch (error) {
                console.error('Error in profile fetch:', error);
                await fetchAndAddAuthProvider();
                updateMenuUserInfo();
                setTimeout(() => updateProfileButton(), 100);
            } finally {
                apiCache.clearPendingRequest();
            }
        })();

        apiCache.setPendingRequest(fetchPromise);

        await fetchPromise;
    } catch (error) {
        console.error('Error loading current user:', error);
        apiCache.clearPendingRequest();
    }
}

async function fetchAndAddAuthProvider() {
    try {
        let headers = {};
        if (typeof getAuthHeaders === 'function') {
            headers = getAuthHeaders();
        }

        const response = await fetch(window.apiUrl('/api/user/auth-provider'), {
            method: 'POST',
            credentials: 'include',
            headers: headers,
            body: JSON.stringify({})
        });

        if (response.ok) {
            const data = await response.json();
            if (window.currentUser) {
                window.currentUser.auth_provider = data.auth_provider;
                localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
                updateProfileButton();
            }
        }
    } catch (error) {
        console.error('Error fetching auth provider:', error);
    }
}

function openUserMenu() {
    if (!userMenuPanel) {
        userMenuPanel = document.getElementById('userMenuPanel');
    }
    if (!userMenuBackdrop) {
        userMenuBackdrop = document.getElementById('userMenuBackdrop');
    }

    if (!userMenuPanel || !userMenuBackdrop) {
        console.error('Menu elements not found');
        return;
    }

    userMenuPanel.classList.add('active');
    userMenuBackdrop.classList.add('active');

    const menuWidth = window.innerWidth <= 768 ? '100%' : '420px';
    const closedRight = window.innerWidth <= 768 ? '-100%' : '-420px';

    userMenuPanel.style.cssText = `position: fixed !important; top: 0 !important; right: 0 !important; width: ${menuWidth} !important; height: 100vh !important; z-index: 9999 !important; display: flex !important; flex-direction: column !important; background: white !important; opacity: 1 !important; visibility: visible !important;`;
    userMenuBackdrop.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(28, 25, 23, 0.5) !important; z-index: 9998 !important; display: block !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;';
    document.body.style.overflow = 'hidden';
    updateMenuUserInfo();
    setTimeout(() => updateProfileButton(), 50);  // Update profile button when menu opens
}

function closeUserMenuPanel() {
    if (!userMenuPanel) userMenuPanel = document.getElementById('userMenuPanel');
    if (!userMenuBackdrop) userMenuBackdrop = document.getElementById('userMenuBackdrop');

    userMenuPanel.classList.remove('active');
    userMenuBackdrop.classList.remove('active');

    const menuWidth = window.innerWidth <= 768 ? '100%' : '420px';
    const closedRight = window.innerWidth <= 768 ? '-100%' : '-420px';

    userMenuPanel.style.cssText = `position: fixed !important; top: 0 !important; right: ${closedRight} !important; width: ${menuWidth} !important; height: 100vh !important; z-index: 9999 !important; display: flex !important; flex-direction: column !important; background: white !important; opacity: 1 !important; visibility: visible !important;`;
    userMenuBackdrop.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(28, 25, 23, 0.5) !important; z-index: 9998 !important; display: block !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important;';
    document.body.style.overflow = '';
}

function updateProfileButton() {
    const profileBtn = document.getElementById('profileAvatarBtn');
    if (!profileBtn) {
        console.warn('profileAvatarBtn element not found');
        return;
    }

    let userObj = null;
    try {
        if (typeof window !== 'undefined' && window.currentUser) {
            userObj = window.currentUser;
        } else {
            const saved = localStorage.getItem('currentUser');
            if (saved) userObj = JSON.parse(saved);
        }
    } catch (err) {
        console.error('Failed to read currentUser for profile button', err);
        return;
    }

    const pictureUrl = typeof resolveAvatarUrl === 'function'
        ? resolveAvatarUrl(userObj)
        : (userObj?.picture || userObj?.avatar || userObj?.photo || userObj?.profilePicture || null);
    const userName = userObj?.name || userObj?.displayName || userObj?.email || 'User';
    const authProvider = userObj?.auth_provider || 'email';

    if (authProvider && authProvider.toLowerCase().includes('google')) {
        profileBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <!-- Gmail/Google icon -->
                <rect width="24" height="24" fill="none"/>
                <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="#EA4335"/>
            </svg>
        `;
        return;
    }

    if (userObj && pictureUrl && pictureUrl.trim() !== '' && isValidImageUrl(pictureUrl)) {
        const img = document.createElement('img');
        img.src = pictureUrl;
        img.alt = userName;
        img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;';
        img.onerror = () => {
            console.warn('Failed to load profile image, keeping SVG');
        };
        img.onload = () => {
        };

        const tempDiv = document.createElement('div');
        tempDiv.appendChild(img);
        profileBtn.innerHTML = tempDiv.innerHTML;
    } else {
    }
}

async function updateProfileDropdown() {
    const dropdownUserName = document.getElementById('dropdownUserName');
    const dropdownUserPlan = document.getElementById('dropdownUserPlan');
    const dropdownUserAvatar = document.getElementById('dropdownUserAvatar');

    let userObj = null;
    try {
        if (typeof window !== 'undefined' && window.currentUser) {
            userObj = window.currentUser;
        } else {
            const saved = localStorage.getItem('currentUser');
            if (saved) userObj = JSON.parse(saved);
        }
    } catch (err) {
        console.error('Failed to read currentUser for dropdown', err);
        return;
    }

    if (!userObj) {
        const usernameText = dropdownUserName?.querySelector('.username-text');
        if (usernameText) usernameText.textContent = 'Guest User';
        if (dropdownUserPlan) dropdownUserPlan.textContent = 'Free Plan';
        return;
    }

    const userName = userObj.name || userObj.displayName || userObj.email || 'User';
    const usernameText = dropdownUserName?.querySelector('.username-text');
    if (usernameText) usernameText.textContent = userName;

    try {
        const response = await fetch(window.apiUrl('/api/user/profile'), {
            method: 'POST',
            credentials: 'include',
            headers: typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
            });
            if (response.ok) {
                const data = await response.json();
                const plan = data.plan || userObj.plan || 'Free';
                const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan';

                const planElement = document.getElementById('dropdownUserPlan');
                if (planElement) {
                    planElement.textContent = planDisplay;
                } else {
                    console.warn('dropdownUserPlan element not found!');
                }

                if (window.currentUser) window.currentUser.plan = plan;
            } else {
                console.warn('Profile API returned non-ok status:', response.status);
                const plan = userObj.plan || 'Free';
                const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan';
                const planElement = document.getElementById('dropdownUserPlan');
                if (planElement) {
                    planElement.textContent = planDisplay;
                }
            }
    } catch (err) {
        console.error('Failed to fetch plan info:', err);
        const plan = userObj.plan || 'Free';
        const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan';
        const planElement = document.getElementById('dropdownUserPlan');
        if (planElement) {
            planElement.textContent = planDisplay;
        }
    }

    const pictureUrl = typeof resolveAvatarUrl === 'function'
        ? resolveAvatarUrl(userObj)
        : (userObj?.picture || userObj?.avatar || userObj?.photo || null);
    if (dropdownUserAvatar) {
        if (pictureUrl && pictureUrl.trim() !== '') {
            const img = document.createElement('img');
            img.src = pictureUrl;
            img.alt = userName;
            img.style.cssText = 'width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;';
            img.onerror = () => {
                console.warn('Failed to load dropdown avatar image');
            };
            dropdownUserAvatar.innerHTML = '';
            dropdownUserAvatar.appendChild(img);
        }
    }
}

function updateMenuUserInfo() {
    const menuUserName = document.getElementById('menuUserName');
    const menuUserEmail = document.getElementById('menuUserEmail');
    const menuUserAvatar = document.getElementById('menuUserAvatar');
    const profileNameDisplay = document.getElementById('profileNameDisplay');
    const emailDisplay = document.getElementById('emailDisplay');

    let userObj = null;
    try {
        if (typeof window !== 'undefined' && window.currentUser) {
            userObj = window.currentUser;
        } else {
            const saved = localStorage.getItem('currentUser');
            if (saved) userObj = JSON.parse(saved);
        }
    } catch (err) {
        console.error('menu: failed to read currentUser', err);
        userObj = null;
    }

    const pictureUrl = typeof resolveAvatarUrl === 'function'
        ? resolveAvatarUrl(userObj)
        : (userObj?.picture || userObj?.avatar || userObj?.photo || userObj?.profilePicture || null);

    if (userObj) {
        const userName = userObj.name || userObj.displayName || userObj.first_name || userObj.firstName || 'User';
        const userEmail = userObj.email || userObj.username || '';

        if (menuUserName) menuUserName.textContent = userName;
        if (menuUserEmail) menuUserEmail.textContent = userEmail;
        if (profileNameDisplay) profileNameDisplay.textContent = userName;
        if (emailDisplay) emailDisplay.textContent = userEmail;

        if (menuUserAvatar) {
            if (pictureUrl && isValidImageUrl(pictureUrl)) {
                menuUserAvatar.innerHTML = ''; // Clear container
                const img = document.createElement('img');
                img.src = pictureUrl;
                img.alt = userName;
                img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%;';
                img.onerror = () => {
                    console.warn('Failed to load menu avatar image');
                };
                menuUserAvatar.appendChild(img);
            } else {
            }
        }
    } else {
        if (menuUserName) menuUserName.textContent = 'Guest User';
        if (menuUserEmail) menuUserEmail.textContent = 'unknown@gmail.com';
        if (profileNameDisplay) profileNameDisplay.textContent = 'Guest User';
        if (emailDisplay) emailDisplay.textContent = 'unknown@gmail.com';
    }

    updateProfileDropdown();
}

function initUserMenu() {

    userMenuPanel = document.getElementById('userMenuPanel');
    userMenuBackdrop = document.getElementById('userMenuBackdrop');
    const closeUserMenuBtn = document.getElementById('closeUserMenu');

    const menuSubscription = document.getElementById('menuSubscription');
    const menuPreferences = document.getElementById('menuPreferences');
    const menuHelp = document.getElementById('menuHelp');
    const menuFeedback = document.getElementById('menuFeedback');
    const menuLogout = document.getElementById('menuLogout');
    const menuViewProfile = document.getElementById('menuViewProfile');
    const menuMyContent = document.getElementById('menuMyContent');

    const editProfileNameBtn = document.getElementById('editProfileNameBtn');
    const editEmailBtn = document.getElementById('editEmailBtn');
    const changePasswordBtn = document.getElementById('changePasswordBtn');

    if (!userMenuPanel) {
        console.error('menu: ERROR - userMenuPanel not found!');
        return;
    }

    updateProfileButton();

    updateProfileDropdown();

    loadAndSetCurrentUser();
    if (closeUserMenuBtn) {
        closeUserMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeUserMenuPanel();
        });
    } else {
        console.warn('Close button element not found with ID: closeUserMenu');
    }

    if (userMenuBackdrop) {
        userMenuBackdrop.addEventListener('click', closeUserMenuPanel);
    }

    if (menuPreferences) {
        menuPreferences.addEventListener('click', () => {
        });
    }

    const notificationsToggle = document.getElementById('notificationsToggle');
    if (notificationsToggle) {
        notificationsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationsToggle.classList.toggle('active');
            const slider = notificationsToggle.querySelector('div');
            if (slider) {
                if (notificationsToggle.classList.contains('active')) {
                    slider.style.right = '3px';
                } else {
                    slider.style.right = '21px';
                }
            }
        });
    }

    if (notificationsToggle && notificationsToggle.classList.contains('active')) {
        const slider = notificationsToggle.querySelector('div');
        if (slider) slider.style.right = '3px';
    }

    if (editProfileNameBtn) {
        editProfileNameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    if (editEmailBtn) {
        editEmailBtn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    if (menuHelp) {
        menuHelp.addEventListener('click', () => {
            closeUserMenuPanel();
            window.open('https://discord.gg/vtPJtQhjNy', '_blank');
        });
    }

    if (menuFeedback) {
        menuFeedback.addEventListener('click', () => {
            closeUserMenuPanel();
        });
    }

    if (menuViewProfile) {
        menuViewProfile.addEventListener('click', () => {
            closeUserMenuPanel();
            window.location.href = '/dashboard.html';
        });
    }

    if (menuMyContent) {
        menuMyContent.addEventListener('click', () => {
            closeUserMenuPanel();
        });
    }

    if (menuLogout) {
        menuLogout.addEventListener('click', () => {
            if (window._logoutInProgress) return;
            if (typeof window._comprehensiveLogout === 'function') {
                window._comprehensiveLogout();
                return;
            }

            closeUserMenuPanel();

            try {
                if (typeof clearUserData === 'function') clearUserData();
            } catch (e) {}

            window._logoutInProgress = true;

            localStorage.clear();
            sessionStorage.clear();
            apiCache.userProfile = null;
            apiCache.userProfileETag = null;
            apiCache.userProfileTime = 0;
            window.currentUser = null;

            sessionStorage.setItem('solis_just_logged_out', '1');
            sessionStorage.setItem('solis_skip_auth_redirect', '1');

            const base = window.apiUrl ? window.apiUrl('/api/auth/logout') : (window.API_BASE_URL || (window.location.origin + '/api')) + '/auth/logout';
            fetch(base, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            })
                .catch(() => {})
                .finally(() => {
                    window.location.replace('/login.html?logout=1');
                });
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'currentUser') {
            updateProfileButton();
        }
    });

    document.addEventListener('user-login', () => {
        updateProfileButton();
    });

    document.addEventListener('user-logout', () => {
        updateProfileButton();
    });

    window.solisMenuDebug = {
        openUserMenu,
        closeUserMenuPanel,
        userMenuPanel,
        userMenuBackdrop,
        updateProfileButton,
        closeUserMenuBtn
    };
}

let menuInitialized = false;

function initializeMenu() {
    if (menuInitialized) {
        return;
    }
    menuInitialized = true;

    initUserMenu();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMenu);
} else {
    initializeMenu();
}

function userProfileIsComplete(user) {
    return Boolean(
        user &&
        typeof user.plan === 'string' &&
        (user.id != null) &&
        typeof user.email === 'string'
    );
}

async function getOrFetchCurrentUser() {
    if (userProfileIsComplete(window.currentUser)) {
        return window.currentUser;
    }

    for (let i = 0; i < 50; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (userProfileIsComplete(window.currentUser)) {
            return window.currentUser;
        }
    }

    const _profileHeaders = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
    try {
        const response = await window.apiRequestCache?.dedupFetch('/api/user/profile', {
            method: 'POST',
            credentials: 'include',
            headers: _profileHeaders,
            body: JSON.stringify({})
        }) || await fetch(window.apiUrl('/api/user/profile'), {
            method: 'POST',
            credentials: 'include',
            headers: _profileHeaders,
            body: JSON.stringify({})
        });

        if (response.ok) {
            const data = await response.json();
            window.currentUser = data;
            return data;
        }
    } catch (err) {
        console.error('Failed to fetch user profile:', err);
    }

    return null;
}
