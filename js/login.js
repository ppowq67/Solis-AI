// Detect post-logout landing before any async work (sync — runs as soon as script loads)
(function detectLogoutLanding() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('logout') || sessionStorage.getItem('solis_just_logged_out') === '1') {
        window.__SOLIS_FORCE_LOGIN_PAGE__ = true;
        sessionStorage.setItem('solis_skip_auth_redirect', '1');
    }
})();

const SKIP_AUTH_REDIRECT_KEY = 'solis_skip_auth_redirect';

const OAUTH_PROVIDERS = {
    google: {
        btnId: 'googleLoginBtn',
        textId: 'googleBtnText',
        label: 'Continue with Google',
        path: '/api/auth/google?fresh=1',
    },
    tiktok: {
        btnId: 'tiktokLoginBtn',
        textId: 'tiktokBtnText',
        label: 'Continue with TikTok',
        path: '/api/auth/tiktok?fresh=1',
    },
    youtube: {
        btnId: 'youtubeLoginBtn',
        textId: 'youtubeBtnText',
        label: 'Continue with YouTube',
        path: '/api/auth/youtube?fresh=1',
    },
};

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
    window.history.replaceState({}, document.title, '/login');

    const base = apiBase();
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

async function initializeCSRFToken() {
    return true;
}

function resetOAuthButton(provider) {
    const cfg = OAUTH_PROVIDERS[provider];
    if (!cfg) return;
    const btn = document.getElementById(cfg.btnId);
    const text = document.getElementById(cfg.textId);
    if (btn) {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
    }
    if (text) text.textContent = cfg.label;
}

function resetAllOAuthButtons() {
    Object.keys(OAUTH_PROVIDERS).forEach(resetOAuthButton);
}

function disableButtonWithCountdown(btn, secs = 3, originalLabel) {
    if (!btn) return;
    btn.disabled = true;
    let rem = secs;
    const span = btn.querySelector('span');
    const orig = originalLabel || (span && span.textContent) || 'Try again';
    const iv = setInterval(() => {
        if (span) span.textContent = `Try again in ${rem}s`;
        rem -= 1;
        if (rem < 0) {
            clearInterval(iv);
            btn.disabled = false;
            if (span) span.textContent = orig;
        }
    }, 1000);
}

function setupEventListeners() {
    Object.entries(OAUTH_PROVIDERS).forEach(([provider, cfg]) => {
        const btn = document.getElementById(cfg.btnId);
        if (!btn) return;
        const handler = () => handleOAuthLogin(provider);
        btn.removeEventListener('click', handler);
        btn.addEventListener('click', handler);
    });
}

function apiBase() {
    if (window.API_BASE_URL) return String(window.API_BASE_URL).replace(/\/$/, '');
    const host = window.location.hostname || '';
    const local = host === 'localhost' || host === '127.0.0.1';
    // Never fall back to :5500 on production — that yields TypeError: Failed to fetch
    if (local) return `${window.location.protocol}//${host}:5500/api`;
    return 'https://api.solisai.video/api';
}

function oauthAuthUrl(path) {
    if (typeof window.apiUrl === 'function') return window.apiUrl(path);
    const base = apiBase();
    let p = String(path || '');
    if (p.startsWith('/api/')) p = p.slice(4);
    else if (p.startsWith('/api')) p = p.slice(4);
    if (!p.startsWith('/')) p = '/' + p;
    return base + p;
}

async function handleOAuthLogin(provider) {
    const cfg = OAUTH_PROVIDERS[provider];
    if (!cfg) return;

    try {
        const btn = document.getElementById(cfg.btnId);
        const text = document.getElementById(cfg.textId);
        if (text) text.textContent = 'Connecting…';
        if (btn) {
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
        }

        try {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('solis_template_memory');
            localStorage.removeItem('solis_caption_by_template');
            localStorage.removeItem('solis_memory_owner_id');
        } catch (_) { /* ignore */ }

        sessionStorage.removeItem(SKIP_AUTH_REDIRECT_KEY);

        // Top-level navigation to API → Google/TikTok/YouTube.
        // Avoids credentialed CORS fetch (browsers reject ACAO:* with credentials).
        const authUrl = oauthAuthUrl(cfg.path);
        const sep = authUrl.includes('?') ? '&' : '?';
        window.location.assign(`${authUrl}${sep}nav=1`);
    } catch (e) {
        sessionStorage.setItem(SKIP_AUTH_REDIRECT_KEY, '1');
        console.error('Login error:', e);
        const msg = String(e && e.message || '');
        const friendly = /failed to fetch|networkerror|load failed/i.test(msg)
            ? 'Could not reach Solis servers. Check your connection and try again.'
            : (msg || 'Login failed. Please check your connection and try again.');
        alert(friendly);
        resetOAuthButton(provider);
        const btn = document.getElementById(cfg.btnId);
        disableButtonWithCountdown(btn, 3, cfg.label);
    }
}

async function setupLoginPage() {
    await waitForInitialization();

    const hasOAuth = Object.values(OAUTH_PROVIDERS).some((cfg) => document.getElementById(cfg.btnId));

    if (isPostLogoutLanding()) {
        finishLogoutLanding();
        if (hasOAuth) setupEventListeners();
        return;
    }

    if (sessionStorage.getItem(SKIP_AUTH_REDIRECT_KEY) === '1') {
        sessionStorage.removeItem(SKIP_AUTH_REDIRECT_KEY);
    }

    if (!hasOAuth) return;

    await initializeCSRFToken();

    try {
        const r = await fetch(`${window.API_BASE_URL}/auth/check`, { method: 'GET', credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            if (d.authenticated && d.user) {
                window.location.replace('/dashboard');
                return;
            }
        }
    } catch (e) { /* ignore */ }

    setupEventListeners();
}

function unlockOAuthUi() {
    resetAllOAuthButtons();
}
window.addEventListener('pageshow', unlockOAuthUi);
window.addEventListener('pagehide', unlockOAuthUi);
window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockOAuthUi();
});
window.addEventListener('focus', unlockOAuthUi);

document.addEventListener('DOMContentLoaded', setupLoginPage);
