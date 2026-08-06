(function detectLogoutLanding() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('logout') || sessionStorage.getItem('solis_just_logged_out') === '1') {
        window.__SOLIS_FORCE_LOGIN_PAGE__ = true;
        sessionStorage.setItem('solis_skip_auth_redirect', '1');
    }
})();

const SKIP_AUTH_REDIRECT_KEY = 'solis_skip_auth_redirect';

function isPostLogoutLanding() {
    return window.__SOLIS_FORCE_LOGIN_PAGE__ === true
        || new URLSearchParams(window.location.search).has('logout')
        || sessionStorage.getItem('solis_just_logged_out') === '1';
}

function shouldSkipAuthRedirect() {
    return sessionStorage.getItem(SKIP_AUTH_REDIRECT_KEY) === '1' || isPostLogoutLanding();
}

function finishLogoutLanding() {
    sessionStorage.setItem(SKIP_AUTH_REDIRECT_KEY, '1');
    sessionStorage.removeItem('solis_just_logged_out');
    window.__SOLIS_FORCE_LOGIN_PAGE__ = false;
    const savedTheme = localStorage.getItem('theme');
    localStorage.clear();
    if (savedTheme) localStorage.setItem('theme', savedTheme);
    window.history.replaceState({}, document.title, '/login.html');

    const base = window.API_BASE_URL || (window.location.origin + '/api');
    fetch(`${base}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
}

async function waitForInitialization() {
    return new Promise((resolve) => {
        if (window.SOLIS_INITIALIZED && window.API_BASE_URL) {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (window.SOLIS_INITIALIZED && window.API_BASE_URL) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 5000);
        }
    });
}

let googleLoginBtn, googleBtnText;

async function initializeCSRFToken() {
    return true;
}

async function setupLoginPage() {
    await waitForInitialization();

    googleLoginBtn = document.getElementById('googleLoginBtn');
    googleBtnText = document.getElementById('googleBtnText');

    if (isPostLogoutLanding()) {
        finishLogoutLanding();
        if (googleLoginBtn && googleBtnText) {
            setupEventListeners();
        }
        return;
    }

    if (shouldSkipAuthRedirect()) {
        if (googleLoginBtn && googleBtnText) {
            setupEventListeners();
        }
        return;
    }

    if (!googleLoginBtn || !googleBtnText) {
        return;
    }

    await initializeCSRFToken();

    try {
        const r = await fetch(`${window.API_BASE_URL}/auth/check`, { method:'GET', credentials:'include' });
        if (r.ok) {
            const d = await r.json();
            if (d.authenticated && d.user) {
                window.location.href = window.location.origin + '/dashboard.html';
                return;
            }
        }
    } catch(e) {}

    setupEventListeners();
}

function getCSRFToken() {
    return null;
}

function disableButtonWithCountdown(btn, secs = 3) {
    btn.disabled = true;
    let rem = secs;
    const orig = btn.querySelector('span').textContent;
    const iv = setInterval(() => {
        btn.querySelector('span').textContent = `Try again in ${rem}s`;
        rem--;
        if (rem < 0) {
            clearInterval(iv);
            btn.disabled = false;
            btn.querySelector('span').textContent = orig;
        }
    }, 1000);
}

function setupEventListeners() {
    if (!googleLoginBtn) return;

    googleLoginBtn.addEventListener('click', handleGoogleLogin);
}

async function handleGoogleLogin() {
    try {
        googleBtnText.textContent = 'Connecting…';
        googleLoginBtn.disabled = true;

        const base = window.API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5500/api`;

        await fetch(`${base}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});

        sessionStorage.removeItem(SKIP_AUTH_REDIRECT_KEY);

        const authUrl = window.apiUrl
            ? window.apiUrl('/api/auth/google?fresh=1')
            : `${base}/auth/google?fresh=1`;
        const r = await fetch(authUrl, { method: 'GET', credentials: 'include' });
        if (!r.ok) throw new Error(`Server error: ${r.status}`);
        const d = await r.json();
        if (d.auth_url) {
            window.location.href = d.auth_url;
            return;
        }
        throw new Error('Authentication unavailable');
    } catch (e) {
        sessionStorage.setItem(SKIP_AUTH_REDIRECT_KEY, '1');
        console.error('Login error:', e);
        alert('Login failed. Please check your connection and try again.');
        googleBtnText.textContent = 'Continue with Google';
        disableButtonWithCountdown(googleLoginBtn, 3);
    }
}

async function secureFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers },
    });
}
document.addEventListener('DOMContentLoaded', setupLoginPage);
