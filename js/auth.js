const AUTH_CONFIG = {
    API_BASE: window.location.origin + '/api',
    ACCESS_TOKEN_DURATION: 3600000,
    REFRESH_CHECK_INTERVAL: 50 * 60 * 1000,
};

let refreshTokenTimer = null;
let refeshCheckTimer = null;
function setupAutoRefresh() {
    if (refeshCheckTimer) clearInterval(refeshCheckTimer);

    refeshCheckTimer = setInterval(async () => {
        await refreshTokenSilently();
    }, AUTH_CONFIG.REFRESH_CHECK_INTERVAL);

}
async function refreshTokenSilently() {
    try {
        const response = await fetch(`${AUTH_CONFIG.API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            return true;
        } else if (response.status === 401) {
            console.warn('[Auth] Refresh failed - session expired, redirecting to login');
            redirectToLogin();
            return false;
        }
    } catch (error) {
        console.error('[Auth] Refresh error:', error);
    }
    return false;
}

async function logoutUser() {
    if (window._logoutInProgress) return;
    window._logoutInProgress = true;

    if (refreshTokenTimer) clearTimeout(refreshTokenTimer);
    if (refeshCheckTimer) clearInterval(refeshCheckTimer);

    localStorage.clear();
    sessionStorage.setItem('solis_just_logged_out', '1');
    sessionStorage.setItem('solis_skip_auth_redirect', '1');

    fetch(`${AUTH_CONFIG.API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    })
        .catch(() => {})
        .finally(() => {
            window.location.replace('/login.html?logout=1');
        });
}

async function isAuthenticated() {
    try {
        const response = await fetch(`${AUTH_CONFIG.API_BASE}/auth/check`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            return data.authenticated === true;
        }
    } catch (error) {
        console.error('[Auth] Authentication check error:', error);
    }
    return false;
}

async function getCurrentUser() {
    try {
        const response = await fetch(`${AUTH_CONFIG.API_BASE}/auth/check`, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            if (data.authenticated && data.user) {
                return data.user;
            }
        }
    } catch (error) {
        console.error('[Auth] Failed to get current user:', error);
    }
    return null;
}

function redirectToLogin() {
    if (!window.location.pathname.includes('login')) {
        window.location.href = '/login.html';
    }
}

async function protectedFetch(url, options = {}) {
    let response = await fetch(url, {
        ...options,
        credentials: 'include'
    });
    if (response.status === 401) {
        const refreshed = await refreshTokenSilently();

        if (refreshed) {
            response = await fetch(url, {
                ...options,
                credentials: 'include'
            });
        } else {
            redirectToLogin();
        }
    }

    return response;
}

function initAuth() {
    setupAutoRefresh();
    isAuthenticated().then(authenticated => {
        if (!authenticated) {
            console.warn('[Auth] Not authenticated, redirecting to login');
            redirectToLogin();
        } else {
        }
    });

}

window.Auth = {
    setup: setupAutoRefresh,
    refresh: refreshTokenSilently,
    logout: logoutUser,
    isAuthenticated,
    getCurrentUser,
    redirectToLogin,
    protectedFetch,
    init: initAuth
};
