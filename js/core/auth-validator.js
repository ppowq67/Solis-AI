/**
 * Lightweight Auth Validator
 * Runs on page load to check JWT cookie validity.
 * Attempts silent refresh before redirecting — access tokens expire hourly.
 */

window.AuthValidator = (() => {
    const apiBase = () => window.API_BASE_URL || (window.location.origin + '/api');

    const tryRefreshSession = async () => {
        try {
            const response = await fetch(`${apiBase()}/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });
            return response.ok;
        } catch (error) {
            console.warn('[Auth] Refresh attempt failed:', error);
            return false;
        }
    };

    const validateAuth = async () => {
        try {
            let response = await fetch(`${apiBase()}/auth/check`, {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) {
                    return { valid: true, user: data.user };
                }
            }

            // Access token may have expired — try refresh token before giving up
            const refreshed = await tryRefreshSession();
            if (refreshed) {
                response = await fetch(`${apiBase()}/auth/check`, {
                    method: 'GET',
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.authenticated) {
                        return { valid: true, user: data.user };
                    }
                }
            }

            return { valid: false };
        } catch (error) {
            console.warn('[Auth] Validation error:', error);
            return { valid: false };
        }
    };

    const isOnAuthPage = () => {
        const path = window.location.pathname;
        return path.includes('login') || path.includes('welcome') || path.includes('auth');
    };

    const redirectToLogin = (reason = '') => {
        const loginUrl = '/login.html' + (reason ? `?redirect=${encodeURIComponent(window.location.pathname)}` : '');
        window.location.href = loginUrl;
    };

    const initialize = async () => {
        if (isOnAuthPage()) {
            return { valid: false };
        }

        const result = await validateAuth();

        if (!result.valid) {
            redirectToLogin('session_expired');
            return result;
        }

        return result;
    };

    return {
        initialize,
        validateAuth,
        tryRefreshSession,
        redirectToLogin,
        isOnAuthPage,
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.AuthValidator.initialize());
} else {
    window.AuthValidator.initialize();
}
